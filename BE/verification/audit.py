"""Audit deployed persistence, access and provenance without invoking Gemini."""

import csv
import hashlib
import json
import secrets
import sys
import subprocess
from pathlib import Path

import httpx
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2] / "artifacts" / "live"


def main():
    run = sys.argv[1] if len(sys.argv) > 1 else "first-live"
    state = json.loads((ROOT / f"{run}-state.json").read_text())
    base = "/api/projects/" + state["project_id"]
    result = {}
    with httpx.Client(base_url="http://localhost:8080", timeout=30) as c:
        assert c.post("/api/auth/login", json={k: state[k] for k in ("email", "password")}).status_code == 200
        p = c.get(base).json()
        assert p["owner_id"] == c.get("/api/auth/me").json()["id"]
        assert c.post("/api/projects", json={"name": ""}).status_code == 422
        assert c.post(base + "/sources", files={"file": ("unsafe.txt", b"not a PDF")}).status_code == 400
        assert c.get("/api/projects/invalid-project").status_code == 404
        assert c.get(base + "/sources/missing-source/file").status_code == 404
        result["validation_and_missing_resources"] = "passed"
        for source in p["sources"]:
            file = ROOT / source["filename"]
            assert c.get(base + "/sources/" + source["id"] + "/file").content == file.read_bytes()
            pages = PdfReader(file).pages
            assert len(pages) == source["page_count"]
            for n, page in enumerate(pages, 1):
                text = c.get(base + f"/sources/{source['id']}/pages/{n}").json()["text"]
                assert " ".join(text.split()) == " ".join(page.extract_text().split())
            for evidence in source["evidence"]:
                assert " ".join(evidence["quote"].split()) in " ".join(
                    pages[evidence["page"] - 1].extract_text().split()
                )
                if run == "verified-live":
                    assert " ".join(evidence["content"].split()) in " ".join(evidence["quote"].split())
            if source["evaluation"]:
                for fact in source["evaluation"]["facts"]:
                    assert " ".join(fact["quote"].split()) in " ".join(
                        pages[fact["page"] - 1].extract_text().split()
                    )
                    assert fact["field"] not in ("authors", "year", "publication", "doi"), (
                        "Fixture has no such metadata"
                    )
        evidence = {e["id"]: e for s in p["sources"] for e in s["evidence"]}
        for draft in p["drafts"]:
            for claim in draft["claims"]:
                assert " ".join(claim["text"].split()) in " ".join(draft["text"].split())
                if claim["check"]:
                    assert all(m["evidence_id"] in evidence for m in claim["check"]["matches"])
        result["provenance"] = {"sources": len(p["sources"]), "verified_evidence": len(evidence)}
        csv_path = ROOT / f"{run}-evidence.csv"
        if csv_path.exists():
            rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig", newline="")))
            assert len(rows) == len(evidence)
            for row in rows:
                source = next(s for s in p["sources"] if s["filename"] == row["Source"])
                assert any(
                    e["quote"] == row["Verified quote"] and str(e["page"]) == row["Page"]
                    for e in source["evidence"]
                )
            result["csv_rows_verified"] = len(rows)
        snapshot = {
            k: p[k]
            for k in [
                "id",
                "owner_id",
                "version",
                "context",
                "confirmed",
                "analysis",
                "sources",
                "drafts",
                "comparisons",
            ]
        }
        serialized = json.dumps(snapshot, sort_keys=True).encode()
        digest = hashlib.sha256(serialized).hexdigest()
        snapshot_path = ROOT / f"{run}-snapshot.sha256"
        if snapshot_path.exists():
            assert snapshot_path.read_text() == digest, "Persisted project changed across restart/reopen"
            result["restart_snapshot"] = "identical"
        else:
            snapshot_path.write_text(digest)
            result["restart_snapshot"] = "baseline saved"
        assert p["operation"] is None
        result["operation_lock"] = "released"
        if p["drafts"] and all(d["status"] == "checked" for d in p["drafts"]):

            def ai_count():
                output = subprocess.check_output(
                    ["docker", "compose", "logs", "backend"], cwd=ROOT.parents[1], stderr=subprocess.DEVNULL
                )
                return output.count(b"Gemini task=")

            before = ai_count()
            assert c.post(base + "/topic/analyze", json={}).status_code == 200
            for s in p["sources"]:
                assert c.post(base + f"/sources/{s['id']}/process", json={}).status_code == 200
            assert c.post(base + "/comparisons", json={}).status_code == 200
            for d in p["drafts"]:
                assert c.post(base + f"/drafts/{d['id']}/check", json={}).status_code == 200
            assert ai_count() == before
            assert c.get(base).json()["version"] == p["version"]
            result["completed_operations_reused"] = (
                "zero additional Gemini calls and unchanged project version"
            )
        second_file = ROOT / f"{run}-second-user.json"
        if second_file.exists():
            other = json.loads(second_file.read_text())
            endpoint = "/api/auth/login"
        else:
            other = {"email": f"other-{run}@example.invalid", "password": secrets.token_urlsafe(24)}
            endpoint = "/api/auth/register"
        with httpx.Client(base_url="http://localhost:8080") as second:
            assert second.post(endpoint, json=other).status_code in (200, 201)
            second_file.write_text(json.dumps(other))
            assert second.get(base).status_code == 404
            for source in p["sources"]:
                assert second.get(base + f"/sources/{source['id']}/file").status_code == 404
                assert second.get(base + f"/sources/{source['id']}/pages/1").status_code == 404
                assert second.post(base + f"/sources/{source['id']}/process", json={}).status_code == 404
            assert second.post(base + "/comparisons", json={}).status_code == 404
            for draft in p["drafts"]:
                assert second.post(base + f"/drafts/{draft['id']}/check", json={}).status_code == 404
            assert second.get("/api/projects").json() == []
        result["second_user_access"] = "denied across project/source/page/evidence/draft/report paths"
    (ROOT / f"{run}-audit.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
