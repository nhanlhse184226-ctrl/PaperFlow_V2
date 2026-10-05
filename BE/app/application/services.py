import hashlib
import hmac
import re
import secrets
import time
from contextlib import contextmanager

from .models import AppError, Check, Claim, Context, Draft, Evidence, Project, Source, Support
from .billing import project_limits
from .ports import AiProvider, FileStorage, PdfExtractor, Repository


def normalize(text):
    return " ".join(text.split())


def grounded(pages, page, quote):
    return len(normalize(quote)) >= 8 and any(
        p.number == page and normalize(quote) in normalize(p.text) for p in pages
    )


def invalidate_reports(project):
    project.comparisons = []
    project.comparison_key = None
    for d in project.drafts:
        d.status, d.error = "saved", None
        for c in d.claims:
            c.check = None


class AuthService:
    def __init__(self, repo: Repository, initial_admin_email: str = ""):
        self.repo = repo
        self.initial_admin_email = initial_admin_email.strip().lower()

    def role_for(self, email):
        return "ADMIN" if email == self.initial_admin_email else "USER"

    @staticmethod
    def password_hash(password):
        salt = secrets.token_hex(16)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return salt + ":" + digest

    def bootstrap_admin(self, email: str, password: str):
        """Create the explicitly configured emergency admin exactly once."""
        email = email.strip().lower()
        if not email or not password:
            return
        existing = self.repo.user(email)
        if existing:
            self.repo.set_role(email, "ADMIN")
            return
        self.repo.register(email, self.password_hash(password), "ADMIN")

    def login(self, email, password, register=False):
        email = email.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 254:
            raise AppError("Enter a valid email address.")
        if len(password) < 3 or len(password) > 128:
            raise AppError("Use a password between 3 and 128 characters.")
        if register:
            user_id = self.repo.register(email, self.password_hash(password), self.role_for(email))
        else:
            user = self.repo.user(email)
            stored = user["password_hash"] if user else ("00" * 16 + ":" + "00" * 64)
            salt, expected = stored.split(":")
            actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
            if not hmac.compare_digest(actual, expected) or not user:
                raise AppError("Email or password is incorrect.", 401)
            user_id = user["id"]
            if self.role_for(email) == "ADMIN":
                self.repo.set_role(email, "ADMIN")
        token = secrets.token_urlsafe(32)
        self.repo.session(hashlib.sha256(token.encode()).hexdigest(), user_id, time.time() + 604800)
        current = self.repo.user(email) or {"role": self.role_for(email)}
        return token, {"id": user_id, "email": email, "role": current.get("role", "USER")}

    def authenticate(self, token):
        user = self.repo.authenticate(hashlib.sha256(token.encode()).hexdigest()) if token else None
        if not user:
            raise AppError("Sign in to continue.", 401)
        return user

    def logout(self, token):
        self.repo.logout(hashlib.sha256(token.encode()).hexdigest())


class WorkspaceService:
    def __init__(self, repo: Repository, ai: AiProvider, pdf: PdfExtractor, files: FileStorage):
        self.repo, self.ai, self.pdf, self.files = repo, ai, pdf, files

    @contextmanager
    def editing(self, owner, pid, label):
        token = self.repo.acquire(owner, pid, label)
        try:
            yield self.repo.get(owner, pid)
        finally:
            self.repo.release(pid, token)

    def record(self, p, activity):
        p.activity = [activity] + p.activity[:19]
        self.repo.save(p)

    def create(self, owner, name):
        p = Project(owner_id=owner, name=name, context=Context(title=name))
        self.repo.create(p)
        return p

    def get(self, owner, pid):
        p = self.repo.get(owner, pid)
        result = p.model_dump(mode="json")
        # Full text is fetched only for a selected page, never duplicated in workspace responses.
        for source in result["sources"]:
            source["page_count"] = len(source.pop("pages"))
        result["operation"] = self.repo.operation(pid)
        return result

    def list(self, owner):
        return [
            {
                "id": p.id,
                "name": p.name,
                "topic": p.context.title,
                "confirmed": p.confirmed,
                "updated_at": p.updated_at,
                "sources": len(p.sources),
                "evaluated": sum(s.evaluation is not None for s in p.sources),
                "evidence": sum(len(s.evidence) for s in p.sources),
                "drafts": len(p.drafts),
            }
            for p in self.repo.list(owner)
        ]

    def rename(self, owner, pid, name):
        with self.editing(owner, pid, "Saving project") as p:
            p.name = name
            self.record(p, "Project renamed")

    def delete(self, owner, pid):
        with self.editing(owner, pid, "Deleting project") as p:
            self.repo.delete(owner, pid)
            for s in p.sources:
                self.files.delete(s.id)

    def topic(self, owner, pid, context):
        with self.editing(owner, pid, "Saving topic") as p:
            if context != p.context:
                p.context, p.analysis, p.confirmed = context, None, False
                p.analysis_translations = {}
                for s in p.sources:
                    s.evaluation = None
                    s.status = "extracted" if s.pages else "failed"
                invalidate_reports(p)
                self.record(p, "Topic updated; confirmation and topic-dependent reports need review")

    def analyze(self, owner, pid, force=False):
        with self.editing(owner, pid, "Analyzing topic") as p:
            if not p.analysis or force:
                result = self.ai.analyze_topic(p.context)
                if len({d.name for d in result.dimensions}) != 6:
                    raise AppError("Topic analysis omitted a readiness dimension. Retry.", 502)
                p.analysis = result
                p.analysis_translations = {}
                self.record(p, "Topic readiness analyzed")

    def translated_topic(self, owner, pid, language):
        with self.editing(owner, pid, "Translating topic analysis") as p:
            if not p.analysis:
                raise AppError("Analyze your topic first.")
            if language == p.context.output_language:
                return p.analysis
            if language not in p.analysis_translations:
                translated = self.ai.translate_topic(p.analysis, language)
                if [(d.name, d.status) for d in translated.dimensions] != [
                    (d.name, d.status) for d in p.analysis.dimensions
                ] or any(
                    len(getattr(translated, key)) != len(getattr(p.analysis, key))
                    for key in ("risks", "missing_information", "directions", "keywords", "next_steps")
                ):
                    raise AppError("Translation changed the analysis structure. Retry.", 502)
                p.analysis_translations[language] = translated
                self.repo.save(p)
            return p.analysis_translations[language]

    def confirm(self, owner, pid):
        with self.editing(owner, pid, "Confirming direction") as p:
            if p.confirmed:
                return
            if not p.analysis:
                raise AppError("Analyze your saved topic before confirming a direction.")
            p.confirmed = True
            self.record(p, "Research direction confirmed")

    def source(self, p, sid):
        source = next((s for s in p.sources if s.id == sid), None)
        if not source:
            raise AppError("Source not found.", 404)
        return source

    def upload(self, owner, pid, filename, content):
        if not filename.lower().endswith(".pdf") or not content.startswith(b"%PDF-"):
            raise AppError("Upload a PDF file.")
        if len(content) > 20 * 1024 * 1024:
            raise AppError("PDF must be 20 MB or smaller.", 413)
        with self.editing(owner, pid, "Extracting PDF pages") as p:
            digest = hashlib.sha256(content).hexdigest()
            existing = next((s for s in p.sources if s.digest == digest), None)
            if existing:
                return existing.id
            limits = project_limits(self.repo.project_billing_state(owner, pid))
            if limits and len(p.sources) >= limits[0]:
                raise AppError("Đã đạt giới hạn tài liệu của gói hiện tại. Xem Gói dịch vụ để nâng cấp.", 403)
            if len(p.sources) >= 30:
                raise AppError("Each project supports up to 30 sources.")
            s = Source(filename=filename.replace("\\", "/").split("/")[-1][:200], digest=digest)
            self.files.put(s.id, content)
            try:
                s.pages = self.pdf.extract(content)
                if sum(len(page.text) for page in s.pages) > 240000:
                    raise AppError(
                        "This source exceeds 240,000 extracted characters. Split it into smaller PDFs."
                    )
                if any(not page.text for page in s.pages):
                    s.warnings.append(
                        "Some pages have no extractable text. Images and scanned content were not analyzed."
                    )
            except AppError as exc:
                s.pages, s.status, s.error = [], "failed", exc.message
            p.sources.append(s)
            invalidate_reports(p)
            self.record(p, f"Uploaded {s.filename}")
            return s.id

    def remove_source(self, owner, pid, sid):
        with self.editing(owner, pid, "Removing source") as p:
            self.source(p, sid)
            p.sources = [s for s in p.sources if s.id != sid]
            invalidate_reports(p)
            self.record(p, "Source removed; evidence reports invalidated")
            self.files.delete(sid)

    def original(self, owner, pid, sid):
        s = self.source(self.repo.get(owner, pid), sid)
        return self.files.read(s.id)

    def page(self, owner, pid, sid, number):
        s = self.source(self.repo.get(owner, pid), sid)
        page = next((page for page in s.pages if page.number == number), None)
        if not page:
            raise AppError("Page not found.", 404)
        return page

    def process(self, owner, pid, sid, force=False):
        with self.editing(owner, pid, "Evaluating source and extracting evidence") as p:
            if not p.confirmed:
                raise AppError("Confirm the research direction first.")
            s = self.source(p, sid)
            if not s.pages:
                raise AppError(s.error or "Upload a readable PDF first.")
            if force:
                s.evaluation = None
                s.evidence_done = False
            if s.evaluation and s.evidence_done and not force:
                return
            try:
                if not s.evaluation or force:
                    # Metadata evaluation uses a clearly disclosed bounded source excerpt.
                    selected, length = [], 0
                    for page in s.pages:
                        if length + len(page.text) > 80000:
                            break
                        selected.append(page)
                        length += len(page.text)
                    evaluation = self.ai.evaluate_source(p.context, selected)
                    valid = [
                        f
                        for f in evaluation.facts
                        if grounded(selected, f.page, f.quote)
                        and normalize(f.value).lower() in normalize(f.quote).lower()
                    ]
                    if len(valid) != len(evaluation.facts):
                        evaluation.warnings.append(
                            "Unverifiable metadata was rejected; missing fields remain unknown."
                        )
                    evaluation.facts = valid
                    if len(selected) < len(s.pages):
                        evaluation.warnings.append(
                            f"Evaluation covers the first {len(selected)} pages only. Evidence extraction covers all readable pages."
                        )
                    s.evaluation = evaluation
                    self.repo.save(p)
                if not s.evidence_done or force:
                    batches, batch, length = [], [], 0
                    for page in s.pages:
                        if batch and length + len(page.text) > 80000:
                            batches.append(batch)
                            batch, length = [], 0
                        batch.append(page)
                        length += len(page.text)
                    if batch:
                        batches.append(batch)
                    extracted, rejected, seen = [], 0, set()
                    for pages in batches:
                        result = self.ai.extract_evidence(p.context, pages)
                        for item in result.items:
                            key = (item.page, normalize(item.quote), item.kind)
                            if not grounded(pages, item.page, item.quote):
                                rejected += 1
                            elif key not in seen:
                                # Do not let a paraphrase add statistical or temporal claims
                                # that the verified quotation does not establish.
                                if normalize(item.content) not in normalize(item.quote):
                                    if len(item.quote) > 4000:
                                        rejected += 1
                                        continue
                                    item.content = item.quote
                                extracted.append(Evidence(**item.model_dump(), source_id=s.id))
                                seen.add(key)
                    s.evidence, s.evidence_done = extracted, True
                    if rejected:
                        s.warnings.append(f"{rejected} ungrounded evidence items were rejected.")
                    invalidate_reports(p)
                s.status, s.error = ("ready" if s.evidence else "partial"), None
                self.record(p, f"Evaluated {s.filename}; {len(s.evidence)} verified quotations")
            except AppError as exc:
                s.status, s.error = "partial" if s.evaluation else "failed", exc.message
                self.repo.save(p)
                raise

    def evidence(self, p):
        return [e for s in p.sources for e in s.evidence]

    def compare(self, owner, pid, source_ids, force=False):
        with self.editing(owner, pid, "Comparing evidence") as p:
            if not p.confirmed:
                raise AppError("Confirm the research direction first.")
            evidence = [e for e in self.evidence(p) if not source_ids or e.source_id in source_ids]
            comparison_key = hashlib.sha256("|".join(sorted(e.id for e in evidence)).encode()).hexdigest()
            if p.comparison_key == comparison_key and not force:
                return
            if len({e.source_id for e in evidence}) < 2:
                raise AppError("Extract evidence from at least two selected sources first.")
            # Round-robin source sampling avoids excluding later sources from a bounded comparison.
            grouped = [[e for e in evidence if e.source_id == s.id] for s in p.sources]
            selected = []
            for i in range(max(map(len, grouped))):
                selected.extend(g[i] for g in grouped if len(g) > i)
                if len(selected) >= 80:
                    break
            selected = selected[:80]
            result = self.ai.compare(p.context, selected)
            valid_ids = {e.id: e for e in selected}
            for item in result.items:
                if (
                    any(i not in valid_ids for i in item.evidence_ids)
                    or len({valid_ids[i].source_id for i in item.evidence_ids}) < 2
                ):
                    raise AppError("AI comparison referenced invalid source evidence. Retry.", 502)
            p.comparisons = result.items
            p.comparison_key = comparison_key
            self.record(p, "Cross-source evidence compared (up to 80 source-balanced items)")

    def save_draft(self, owner, pid, title, text, draft_id=None):
        draft = Draft(title=title, text=text)
        with self.editing(owner, pid, "Saving draft") as p:
            if draft_id:
                old = next((d for d in p.drafts if d.id == draft_id), None)
                if not old:
                    raise AppError("Draft not found.", 404)
                old.title, old.text, old.claims, old.status, old.error = title, text, [], "saved", None
                draft = old
            else:
                limits = project_limits(self.repo.project_billing_state(owner, pid))
                if limits and len(p.drafts) >= limits[1]:
                    raise AppError("Đã đạt giới hạn bản thảo của gói hiện tại. Xem Gói dịch vụ để nâng cấp.", 403)
                if len(p.drafts) >= 20:
                    raise AppError("Each project supports up to 20 drafts.")
                p.drafts.append(draft)
            self.record(p, "Draft saved")
            return draft.id

    def upload_draft(self, owner, pid, filename, content):
        if len(content) > 20 * 1024 * 1024:
            raise AppError("Draft upload must be 20 MB or smaller.", 413)
        if filename.lower().endswith(".pdf"):
            text = "\n\n".join(p.text for p in self.pdf.extract(content))
        elif filename.lower().endswith((".txt", ".md")):
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                raise AppError("Save the text file with UTF-8 encoding.") from None
        else:
            raise AppError("Upload a PDF, TXT, or Markdown draft.")
        if len(text) < 20 or len(text) > 60000:
            raise AppError("Drafts must contain 20–60,000 characters. Upload a section if necessary.")
        return self.save_draft(owner, pid, filename[:200], text)

    def check_draft(self, owner, pid, did, force=False):
        with self.editing(owner, pid, "Checking claims against project evidence") as p:
            if not p.confirmed:
                raise AppError("Confirm the research direction first.")
            draft = next((d for d in p.drafts if d.id == did), None)
            if not draft:
                raise AppError("Draft not found.", 404)
            if draft.status == "checked" and not force:
                return
            deadline = time.monotonic() + 900
            try:
                if not draft.claims or force:
                    result = self.ai.extract_claims(draft.text)
                    if any(normalize(c.text) not in normalize(draft.text) for c in result.claims):
                        raise AppError("AI returned claims that do not occur in the draft. Retry.", 502)
                    draft.claims = [Claim(text=c.text) for c in result.claims]
                    self.repo.save(p)
                evidence = self.evidence(p)
                for claim in draft.claims:
                    if claim.check and not force:
                        continue
                    if time.monotonic() > deadline:
                        raise AppError(
                            "Check paused at the processing time limit. Retry to continue saved claims.", 503
                        )
                    if not evidence:
                        claim.check = Check(
                            status=Support.INSUFFICIENT_EVIDENCE,
                            relevance="Not assessed",
                            matches=[],
                            citation_issue="Not assessed without source evidence",
                            limitation="No extracted project evidence is available.",
                            action="Upload and process sources, then rerun this check.",
                            explanation="A claim cannot be verified without evidence.",
                        )
                    else:
                        words = set(re.findall(r"\w{3,}", claim.text.lower()))
                        ranked = sorted(
                            evidence,
                            key=lambda e: len(
                                words & set(re.findall(r"\w{3,}", (e.content + " " + e.quote).lower()))
                            ),
                            reverse=True,
                        )
                        selected = ranked[:40]
                        result = self.ai.check_claim(p.context, claim.text, selected)
                        ids = {e.id for e in selected}
                        if any(m.evidence_id not in ids for m in result.matches) or len(
                            {m.evidence_id for m in result.matches}
                        ) != len(result.matches):
                            raise AppError("AI returned an invalid evidence reference. Retry.", 502)
                        relations = {m.relation for m in result.matches}
                        original_status = result.status
                        if result.status in (
                            Support.UNSUPPORTED,
                            Support.INSUFFICIENT_EVIDENCE,
                        ) and relations - {"context"}:
                            raise AppError(
                                "AI returned inconsistent claim status and evidence relationships. No new result was accepted; retry the check.",
                                502,
                            )
                        if "contradictory" in relations and (
                            "supporting" in relations or "partial" in relations
                        ):
                            result.status = Support.PARTIALLY_SUPPORTED
                        elif "contradictory" in relations:
                            result.status = Support.CONTRADICTED
                        elif "partial" in relations:
                            result.status = Support.PARTIALLY_SUPPORTED
                        elif result.status == Support.SUPPORTED and "supporting" not in relations:
                            result.status = Support.INSUFFICIENT_EVIDENCE
                        elif result.status in (Support.PARTIALLY_SUPPORTED, Support.CONTRADICTED) and not (
                            relations - {"context"}
                        ):
                            result.status = Support.INSUFFICIENT_EVIDENCE
                        if result.status != original_status:
                            result.explanation = (
                                f"Overall status is {result.status.value.lower().replace('_', ' ')} based on the evidence relationships. "
                                + (
                                    "The evidence is mixed or supports only a narrower claim; qualify the assertion. "
                                    if result.status == Support.PARTIALLY_SUPPORTED
                                    else "The selected evidence does not establish the original assessment. "
                                )
                                + " ".join(m.explanation for m in result.matches)
                            )
                        result.limitation += f" Reviewed {len(selected)} of {len(evidence)} extracted items using lexical retrieval; unselected evidence and unextracted content may change this assessment."
                        claim.check = result
                    self.repo.save(p)
                draft.status, draft.error = "checked", None
                self.record(p, f"Checked {len(draft.claims)} claims in {draft.title}")
            except AppError as exc:
                draft.status, draft.error = (
                    "partial" if any(c.check for c in draft.claims) else "failed",
                    exc.message,
                )
                self.repo.save(p)
                raise

    def notes(self, query):
        return self.repo.notes(query)

    def post_note(self, owner, topic, note):
        self.repo.post_note(owner, topic, note)
