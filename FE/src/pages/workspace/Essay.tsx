import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  FileText,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { api, apiUrl } from "../../api";
import { useLanguage } from "../../i18n";
import { Badge, Empty, Notice, Modal, readable } from "../../ui";
import type { Claim, Draft, WorkspaceProps } from "../../types";
import AiFeedback from "../../components/AiFeedback";

type ClaimReviewTranslation = {
  explanation: string;
  relevance: string;
  citation_issue: string;
  limitation: string;
  action: string;
  matches: string[];
};

export default function Essay({ p, run, busy, base, inspect }: WorkspaceProps) {
  const [did, setDid] = useState(p.drafts[0]?.id || ""),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [editing, setEditing] = useState(!p.drafts.length),
    [claim, setClaim] = useState<Claim | null>(null),
    [claimTranslation, setClaimTranslation] = useState<{
      claimId: string;
      value: ClaimReviewTranslation;
    } | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const language = useLanguage();
  const draft = p.drafts.find((d) => d.id === did) || p.drafts[0];
  // Existing drafts can contain combining Vietnamese marks from a pasted
  // document. Normalize at display time as well as at save time so older
  // drafts render consistently.
  const displayDraftText = draft?.text.normalize("NFC") || "";
  const activeClaim = draft?.claims.find((c) => c.id === claim?.id);
  const claimTranslationKey = activeClaim?.check
    ? JSON.stringify(activeClaim.check)
    : "";
  const reviewTranslation =
    claimTranslation && claimTranslation.claimId === activeClaim?.id
      ? claimTranslation.value
      : null;
  useEffect(() => {
    let current = true;
    if (!draft || !activeClaim?.check) {
      setClaimTranslation(null);
      return () => {
        current = false;
      };
    }
    setClaimTranslation(null);
    void api<ClaimReviewTranslation>(
      `${base}/drafts/${draft.id}/claims/${activeClaim.id}/translation`,
      "POST",
      { language },
    )
      .then((value) => {
        if (current) setClaimTranslation({ claimId: activeClaim.id, value });
      })
      .catch(() => {
        if (current) setClaimTranslation(null);
      });
    return () => {
      current = false;
    };
  }, [
    activeClaim?.id,
    base,
    claimTranslationKey,
    draft?.id,
    language,
    p.context.output_language,
  ]);
  function edit(d?: Draft) {
    setDid(d?.id || "");
    setTitle((d?.title || "").normalize("NFC"));
    setText((d?.text || "").normalize("NFC"));
    setEditing(true);
  }
  async function save() {
    const normalizedTitle = title.normalize("NFC");
    const normalizedText = text.normalize("NFC");
    setTitle(normalizedTitle);
    setText(normalizedText);
    const result = await api<{ id: string }>(
      base + "/drafts" + (did ? "/" + did : ""),
      did ? "PUT" : "POST",
      { title: normalizedTitle, text: normalizedText },
    );
    setDid(result.id);
    setEditing(false);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Does your evidence support your writing?</h2>
          <p>Trace the claims in your draft back to your project’s sources.</p>
        </div>
        <div className="actions">
          <button disabled={busy} onClick={() => upload.current?.click()}>
            <Upload size={16} />
            Upload draft
          </button>
          <button className="primary" disabled={busy} onClick={() => edit()}>
            <Plus size={16} />
            New draft
          </button>
        </div>
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept=".txt,.md,.pdf"
          aria-label="Upload academic draft"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void run("Reading and saving draft", async () => {
                const form = new FormData();
                form.append("file", f);
                const result = await api<{ id: string }>(
                  base + "/draft-upload",
                  "POST",
                  form,
                );
                setDid(result.id);
                setEditing(false);
              });
            e.target.value = "";
          }}
        />
      </div>
      {p.drafts.length > 0 && (
        <div className="draft-tabs">
          {p.drafts.map((d) => (
            <button
              className={draft?.id === d.id && !editing ? "active" : ""}
              key={d.id}
              onClick={() => {
                setDid(d.id);
                setEditing(false);
              }}
            >
              <FileText size={16} />
              {d.title}
              <Badge>{d.status}</Badge>
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <section className="panel draft-editor">
          <h3>
            {did ? "Edit your draft" : "Bring your writing into the workspace"}
          </h3>
          <p className="muted">
            Paste an essay, literature review, report, or thesis section.
            Editing resets this draft’s evidence check.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Saving draft", save);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Draft title
                <input
                  required
                  minLength={1}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Literature review · first draft"
                />
              </label>
              <label>
                Academic draft
                <textarea
                  rows={13}
                  required
                  minLength={20}
                  maxLength={60000}
                  value={text}
                  lang={language === "vi" ? "vi" : "en"}
                  spellCheck={false}
                  onBlur={(e) => {
                    setText(e.currentTarget.value.normalize("NFC"));
                  }}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your writing here, including any in-text citations…"
                />
              </label>
              <div className="section-heading">
                <small>
                  {text.length.toLocaleString()} / 60,000 characters
                </small>
                <button className="primary">
                  Save draft
                  <Check size={16} />
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      ) : draft ? (
        <>
          <section className="draft-header panel">
            <div>
              <Badge>{draft.status}</Badge>
              <h3>{draft.title}</h3>
              <p>{draft.claims.length} claims to review against your uploaded evidence.</p>
            </div>
            <div className="actions">
              <button disabled={busy} onClick={() => edit(draft)}>
                Edit draft
              </button>
              <button
                className="primary"
                disabled={busy || !p.confirmed}
                onClick={() =>
                  void run("Extracting and checking claims", () =>
                    api(base + "/drafts/" + draft.id + "/check", "POST", {
                      force: draft.status === "checked",
                    }),
                  )
                }
              >
                <Sparkles size={16} />
                {draft.status === "checked"
                  ? "Run a new check"
                  : "Check evidence"}
              </button>
              {draft.claims.length > 0 && (
                <a className="button" href={apiUrl(base + "/drafts/" + draft.id + "/review.docx")}>
                  Export Word comments
                </a>
              )}
            </div>
          </section>
          {draft.error && <Notice>{draft.error}</Notice>}
          {draft.claims.length > 0 ? (
            <>
              <section className="essay-review" aria-label="Annotated draft review">
                <article className="essay-paper">
                  {displayDraftText.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{renderAnnotatedText(paragraph, draft.claims, setClaim)}</p>
                  ))}
                </article>
                <aside className="comment-rail" aria-label="Review comments">
                  <h3>Comments</h3>
                  <details className="comment-coverage">
                    <summary>{draft.claims.length} claims reviewed</summary>
                    <div>{["SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE"].map((status) => <span key={status}><strong>{draft.claims.filter((c) => c.check?.status === status).length}</strong> {readable(status)}</span>)}</div>
                  </details>
                  {draft.claims.map((item, index) => (
                    <button key={item.id} className="comment-card" onClick={() => setClaim(item)}>
                      <span>{index + 1}</span>
                      <div><Badge tone={item.check?.status === "SUPPORTED" ? "good" : item.check?.status === "CONTRADICTED" ? "bad" : "warm"}>{item.check ? readable(item.check.status) : "Awaiting check"}</Badge><p>{reviewQuestion(item)}</p></div>
                    </button>
                  ))}
                </aside>
              </section>
              <AiFeedback module="essay_evidence_check" projectId={p.id} resultId={draft.id} />
            </>
          ) : (
            <Empty
              icon={<FileCheck2 size={28} />}
              title={
                draft.status === "checked"
                  ? "No factual claims extracted"
                  : "Your draft is ready for an evidence check"
              }
            >
              <p>
                {draft.status === "checked"
                  ? "No meaningful research claims were identified in this text. Try a section containing factual assertions."
                  : "Confirm your topic and run the check to identify claims, supporting sources, and evidence gaps."}
              </p>
            </Empty>
          )}
          <details className="panel saved-draft">
            <summary>Read saved draft</summary>
            <p>{displayDraftText}</p>
          </details>
        </>
      ) : (
        <Empty title="From evidence to stronger claims">
          <p>Paste or upload a draft to begin.</p>
        </Empty>
      )}
      {activeClaim && (
        <Modal wide title="Claim evidence review" close={() => setClaim(null)}>
          <h3>{activeClaim.text}</h3>
          {activeClaim.check ? (
            <>
              <Badge
                tone={
                  activeClaim.check.status === "SUPPORTED" ? "good" : "warm"
                }
              >
                {readable(activeClaim.check.status)}
              </Badge>
              <p>{reviewTranslation?.explanation || activeClaim.check.explanation}</p>
              <div className="evaluation-block">
                <h4>Topic relevance</h4>
                <p>{reviewTranslation?.relevance || activeClaim.check.relevance}</p>
                <h4>Citation coverage</h4>
                <p>{reviewTranslation?.citation_issue || activeClaim.check.citation_issue}</p>
                <h4>Evidence limitations</h4>
                <p>{reviewTranslation?.limitation || activeClaim.check.limitation}</p>
                <h4>Recommended action</h4>
                <p>{reviewTranslation?.action || activeClaim.check.action}</p>
              </div>
              <h3 className="subheading">Evidence connections</h3>
              {activeClaim.check.matches.length ? (
                activeClaim.check.matches.map((m, index) => {
                  const e = p.sources
                    .flatMap((s) => s.evidence)
                    .find((e) => e.id === m.evidence_id);
                  return e ? (
                    <div className="match" key={m.evidence_id}>
                      <Badge>{m.relation}</Badge>
                      <p>{reviewTranslation?.matches[index] || m.explanation}</p>
                      <blockquote>{e.quote}</blockquote>
                      <button
                        className="text-button"
                        onClick={() => {
                          setClaim(null);
                          inspect(e);
                        }}
                      >
                        {p.sources.find((s) => s.id === e.source_id)?.filename}{" "}
                        · page {e.page}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : null;
                })
              ) : (
                <p className="muted">
                  No matching evidence was identified. This does not establish
                  that the claim is false.
                </p>
              )}
            </>
          ) : (
            <p>
              Processing has not reached this claim yet. Continue the evidence
              check.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function renderAnnotatedText(text: string, claims: Claim[], select: (claim: Claim) => void) {
  const matches = claims
    .map((claim, index) => ({
      claim,
      index,
      text: claim.text.normalize("NFC"),
      start: text.indexOf(claim.text.normalize("NFC")),
    }))
    .filter((item) => item.start >= 0)
    .sort((left, right) => left.start - right.start);
  if (!matches.length) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const item of matches) {
    if (item.start < cursor) continue;
    if (item.start > cursor) parts.push(text.slice(cursor, item.start));
    parts.push(<button className="essay-anchor" key={item.claim.id} onClick={() => select(item.claim)}>{item.text}<sup>{item.index + 1}</sup></button>);
    cursor = item.start + item.text.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function reviewQuestion(claim: Claim) {
  const subject = claim.text.length > 130 ? claim.text.slice(0, 127) + "…" : claim.text;
  if (claim.check?.status === "SUPPORTED") return `Does the evidence support this wording under the same scope?`;
  if (claim.check?.status === "PARTIALLY_SUPPORTED") return `Which condition or scope would make “${subject}” more precise?`;
  if (claim.check?.status === "CONTRADICTED") return `How does the evidence pointing elsewhere change this argument?`;
  return `Is “${subject}” an evidence-backed conclusion, or a question to qualify and investigate further?`;
}
