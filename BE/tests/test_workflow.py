import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.application.models import AppError
from app.infrastructure.files import PypdfExtractor
from app.main import Settings, create_app
from tests.fakes import CLAIM, QUOTE, FakeAi, pdf_bytes


@pytest.fixture
def setup(tmp_path):
    ai = FakeAi()
    app = create_app(Settings(data_dir=tmp_path, allowed_origins="http://testserver"), ai=ai)
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register", json={"email": "student@example.edu", "password": "correct horse battery"}
        )
        assert response.status_code == 201
        yield client, ai, app


def project(client):
    r = client.post("/api/projects", json={"name": "Programming feedback"})
    assert r.status_code == 201
    base = "/api/projects/" + r.json()["id"]
    assert client.post(base + "/topic/analyze", json={}).status_code == 200
    assert client.post(base + "/topic/confirm").status_code == 200
    return base


def test_topic_translation_cache_preserves_original_and_invalidates(setup):
    client, ai, _ = setup
    base = project(client)
    original = client.get(base).json()["analysis"]
    calls = []

    def translate(analysis, language):
        calls.append(language)
        return analysis.model_copy(update={"summary": "Cần dữ liệu phù hợp cho câu hỏi nghiên cứu."})

    ai.translate_topic = translate
    for _ in range(2):
        response = client.post(base + "/topic/translation", json={"language": "vi"})
        assert response.status_code == 200
        assert response.json()["summary"].startswith("Cần dữ liệu")
    assert calls == ["vi"]
    assert client.get(base).json()["analysis"] == original
    assert client.post(base + "/topic/translation", json={"language": "en"}).json() == original
    assert client.post(base + "/topic/translation", json={"language": "xx"}).status_code == 422
    assert client.post(base + "/topic/analyze", json={"force": True}).status_code == 200
    assert client.get(base).json()["analysis_translations"] == {}


def test_topic_translation_rejects_changed_verdict(setup):
    client, ai, _ = setup
    base = project(client)

    def translate(analysis, language):
        changed = analysis.model_copy(deep=True)
        changed.dimensions[0].status = "ready"
        return changed

    ai.translate_topic = translate
    assert client.post(base + "/topic/translation", json={"language": "vi"}).status_code == 502
    assert client.get(base).json()["analysis_translations"] == {}


def source(client, base, variant=False):
    response = client.post(
        base + "/sources",
        files={
            "file": (
                "paper.pdf",
                pdf_bytes(QUOTE + (" A second study." if variant else "")),
                "application/pdf",
            )
        },
    )
    assert response.status_code == 201
    sid = response.json()["id"]
    assert client.post(base + "/sources/" + sid + "/process", json={}).status_code == 200
    return sid


def test_complete_workflow_and_persistence(setup):
    client, ai, app = setup
    base = project(client)
    first = source(client, base)
    second = source(client, base, True)
    p = client.get(base).json()
    assert p["sources"][0]["page_count"] == 1
    assert "pages" not in p["sources"][0]
    assert len(p["sources"][0]["evaluation"]["facts"]) == 1
    assert len(p["sources"][0]["evidence"]) == 1
    assert p["sources"][0]["evidence"][0]["quote"] == QUOTE
    assert p["sources"][0]["evidence"][0]["content"] == QUOTE
    assert client.get(base + f"/sources/{first}/pages/1").json()["text"] == QUOTE
    assert client.get(base + f"/sources/{first}/file").content.startswith(b"%PDF-")
    assert client.post(base + "/comparisons", json={"source_ids": [first, second]}).status_code == 200
    did = client.post(base + "/drafts", json={"title": "Literature review", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 200
    report = client.get(base).json()["drafts"][0]
    assert report["status"] == "checked"
    assert report["claims"][0]["check"]["status"] == "SUPPORTED"
    before = list(ai.calls)
    client.post(base + f"/drafts/{did}/check", json={})
    client.post(base + f"/sources/{first}/process", json={})
    client.post(base + "/topic/analyze", json={})
    client.post(base + "/comparisons", json={"source_ids": [first, second]})
    assert ai.calls == before
    p = app.state.repo.get(client.get("/api/auth/me").json()["id"], base.split("/")[-1])
    assert p.drafts[0].claims[0].check.matches[0].evidence_id in {e.id for s in p.sources for e in s.evidence}
    with sqlite3.connect(app.state.repo.path) as db:
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert db.execute("SELECT COUNT(*) FROM migrations").fetchone()[0] == 2
    assert client.delete(base + f"/sources/{first}").status_code == 200
    p = client.get(base).json()
    assert p["comparisons"] == []
    assert p["drafts"][0]["claims"][0]["check"] is None


@pytest.mark.parametrize(
    "mode,status",
    [
        ("supported", "SUPPORTED"),
        ("mixed", "PARTIALLY_SUPPORTED"),
        ("partial", "PARTIALLY_SUPPORTED"),
        ("contradicted", "CONTRADICTED"),
        ("unsupported", "UNSUPPORTED"),
    ],
)
def test_support_states(setup, mode, status):
    client, ai, _ = setup
    base = project(client)
    source(client, base)
    source(client, base, True)
    ai.mode = mode
    did = client.post(base + "/drafts", json={"title": "Draft", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 200
    check = client.get(base).json()["drafts"][0]["claims"][0]["check"]
    assert check["status"] == status
    if mode == "mixed":
        assert "mixed" in check["explanation"]
        assert "Assessment based on project evidence." not in check["explanation"]


def test_no_evidence_is_insufficient(setup):
    client, ai, _ = setup
    base = project(client)
    did = client.post(base + "/drafts", json={"title": "Draft", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 200
    assert client.get(base).json()["drafts"][0]["claims"][0]["check"]["status"] == "INSUFFICIENT_EVIDENCE"
    assert "check" not in ai.calls


def test_invalid_evidence_reference_is_not_saved(setup):
    client, ai, _ = setup
    base = project(client)
    source(client, base)
    ai.mode = "invalid"
    did = client.post(base + "/drafts", json={"title": "Draft", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 502
    d = client.get(base).json()["drafts"][0]
    assert d["status"] == "failed" and d["claims"][0]["check"] is None


def test_topic_invalidation(setup):
    client, _, _ = setup
    base = project(client)
    source(client, base)
    context = client.get(base).json()["context"]
    context["title"] = "New research direction"
    assert client.put(base + "/topic", json=context).status_code == 200
    p = client.get(base).json()
    assert p["analysis"] is None and not p["confirmed"]
    assert p["sources"][0]["evaluation"] is None
    assert len(p["sources"][0]["evidence"]) == 1
    assert client.post(base + "/topic/confirm").status_code == 400


def test_auth_ownership_and_csrf(setup):
    client, _, app = setup
    base = project(client)
    sid = source(client, base)
    assert (
        client.post(
            "/api/projects", json={"name": "Bad origin"}, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get(base).status_code == 401
    client.post(
        "/api/auth/register", json={"email": "other@example.edu", "password": "another long password"}
    )
    for route in [base, base + f"/sources/{sid}/file", base + f"/sources/{sid}/pages/1"]:
        assert client.get(route).status_code == 404
    assert client.delete(base).status_code == 404
    assert client.post(base + f"/sources/{sid}/process", json={}).status_code == 404
    assert client.get("/api/projects").json() == []
    assert app.state.repo.user("student@example.edu")["password_hash"] != "correct horse battery"


def test_validation_upload_failures_and_duplicate(setup):
    client, _, _ = setup
    base = project(client)
    assert client.post("/api/projects", json={"name": "x"}).status_code == 422
    assert client.post(base + "/sources", files={"file": ("bad.pdf", b"not pdf")}).status_code == 400
    failed = client.post(base + "/sources", files={"file": ("broken.pdf", b"%PDF-broken")})
    assert failed.status_code == 201
    assert client.get(base).json()["sources"][0]["status"] == "failed"
    sid = source(client, base)
    duplicate = client.post(base + "/sources", files={"file": ("again.pdf", pdf_bytes())})
    assert duplicate.json()["id"] == sid
    response = client.post(base + "/draft-upload", files={"file": ("draft.txt", CLAIM.encode())})
    assert response.status_code == 201
    assert client.post(base + "/draft-upload", files={"file": ("draft.docx", b"bad")}).status_code == 400


def test_pdf_extraction_and_scan_error():
    assert PypdfExtractor().extract(pdf_bytes())[0].text == QUOTE
    with pytest.raises(AppError, match="No readable text"):
        PypdfExtractor().extract(pdf_bytes(""))


def test_leases_versions_and_migrations(setup):
    client, _, app = setup
    base = project(client)
    pid = base.split("/")[-1]
    owner = client.get("/api/auth/me").json()["id"]
    repo = app.state.repo
    token = repo.acquire(owner, pid, "Testing lease")
    assert client.post(base + "/topic/analyze", json={}).status_code == 409
    assert client.get(base).json()["operation"]["label"] == "Testing lease"
    repo.release(pid, token)
    original = repo.get(owner, pid)
    stale = repo.get(owner, pid)
    repo.save(original)
    with pytest.raises(AppError, match="changed"):
        repo.save(stale)
    from app.infrastructure.repository import SqliteRepository

    assert SqliteRepository(repo.path).get(owner, pid).confirmed


def test_partial_failure_resumes_and_draft_edit_resets(setup):
    client, ai, _ = setup
    base = project(client)
    sid = source(client, base)
    normal = ai.extract_evidence
    ai.extract_evidence = lambda *args: (_ for _ in ()).throw(AppError("Provider unavailable", 502))
    assert client.post(base + f"/sources/{sid}/process", json={"force": True}).status_code == 502
    s = client.get(base).json()["sources"][0]
    assert s["evaluation"] and s["evidence"] and s["status"] == "partial"
    ai.extract_evidence = normal
    assert client.post(base + f"/sources/{sid}/process", json={"force": True}).status_code == 200
    did = client.post(base + "/drafts", json={"title": "Draft", "text": CLAIM}).json()["id"]
    client.post(base + f"/drafts/{did}/check", json={})
    assert (
        client.put(
            base + f"/drafts/{did}", json={"title": "Revised", "text": CLAIM + " More context."}
        ).status_code
        == 200
    )
    assert client.get(base).json()["drafts"][0]["claims"] == []


def test_hub_and_project_deletion(setup):
    client, _, app = setup
    base = project(client)
    sid = source(client, base)
    assert (
        client.post(
            "/api/hub", json={"topic": "Feedback", "note": "Plan dataset access before choosing a scope."}
        ).status_code
        == 201
    )
    assert len(client.get("/api/hub?q=feedback").json()) == 1
    assert client.delete(base).status_code == 200
    assert client.get(base).status_code == 404
    assert not app.state.service.files.path(sid).exists()


def test_missing_configuration_is_actionable_api_error(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, gemini_api_key=""))
    with TestClient(app) as client:
        client.post(
            "/api/auth/register", json={"email": "no-key@example.edu", "password": "a long test password"}
        )
        pid = client.post("/api/projects", json={"name": "A saved topic"}).json()["id"]
        response = client.post(f"/api/projects/{pid}/topic/analyze", json={})
        assert response.status_code == 503
        assert "GEMINI_API_KEY" in response.json()["message"]
        assert client.get(f"/api/projects/{pid}").json()["operation"] is None


def test_empty_quote_and_wrong_page_are_not_grounded():
    from app.application.models import Page
    from app.application.services import grounded

    pages = [Page(number=1, text=QUOTE)]
    assert not grounded(pages, 1, "         ")
    assert not grounded(pages, 2, QUOTE)
    assert grounded(pages, 1, QUOTE.replace(" ", "\n"))


def test_production_requires_secure_cookie(tmp_path):
    with pytest.raises(RuntimeError, match="SECURE_COOKIES"):
        create_app(Settings(data_dir=tmp_path, environment="production", secure_cookies=False))


def test_resume_extraction_reuses_successful_evaluation(setup):
    client, ai, _ = setup
    base = project(client)
    response = client.post(base + "/sources", files={"file": ("paper.pdf", pdf_bytes(), "application/pdf")})
    sid = response.json()["id"]
    normal = ai.extract_evidence
    ai.extract_evidence = lambda *args: (_ for _ in ()).throw(AppError("Temporary failure", 503))
    assert client.post(base + f"/sources/{sid}/process", json={}).status_code == 503
    before = ai.calls.count("evaluate")
    ai.extract_evidence = normal
    assert client.post(base + f"/sources/{sid}/process", json={}).status_code == 200
    assert ai.calls.count("evaluate") == before
    p = client.get(base).json()
    assert p["sources"][0]["status"] == "ready"
    version = p["version"]
    assert client.post(base + "/topic/confirm").status_code == 200
    assert client.get(base).json()["version"] == version


@pytest.mark.parametrize("status", ["UNSUPPORTED", "INSUFFICIENT_EVIDENCE"])
def test_gap_context_is_not_support_or_counterevidence(setup, status):
    from app.application.models import Match, Support

    client, ai, _ = setup
    base = project(client)
    source(client, base)
    normal = ai.check_claim

    def gap(context, claim, evidence):
        result = normal(context, claim, evidence)
        result.status = Support(status)
        result.matches = [
            Match(evidence_id=evidence[0].id, relation="context", explanation="Outcome was not measured.")
        ]
        return result

    ai.check_claim = gap
    did = client.post(base + "/drafts", json={"title": "Gap", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 200
    check = client.get(base).json()["drafts"][0]["claims"][0]["check"]
    assert check["status"] == status and check["matches"][0]["relation"] == "context"


def test_inconsistent_unsupported_relationship_is_rejected(setup):
    from app.application.models import Support

    client, ai, _ = setup
    base = project(client)
    source(client, base)
    normal = ai.check_claim

    def inconsistent(*args):
        result = normal(*args)
        result.status = Support.UNSUPPORTED
        return result

    ai.check_claim = inconsistent
    did = client.post(base + "/drafts", json={"title": "Inconsistent", "text": CLAIM}).json()["id"]
    assert client.post(base + f"/drafts/{did}/check", json={}).status_code == 502
    assert client.get(base).json()["drafts"][0]["claims"][0]["check"] is None
