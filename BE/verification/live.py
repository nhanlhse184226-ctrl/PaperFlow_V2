"""Opt-in real HTTP workflow. Uses the running application's real AI provider."""

import json
import secrets
import sys
import time
from pathlib import Path

import httpx
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2] / "artifacts" / "live"


def main():
    run_id = sys.argv[1] if len(sys.argv) > 1 else str(int(time.time()))
    state_path = ROOT / f"{run_id}-state.json"
    report_path = ROOT / f"{run_id}-report.json"
    state = (
        json.loads(state_path.read_text())
        if state_path.exists()
        else {"email": f"live-{run_id}@example.invalid", "password": secrets.token_urlsafe(24)}
    )
    report = {"run_id": run_id, "steps": [], "live_provider": True}
    with httpx.Client(base_url="http://localhost:8080", timeout=1200) as client:

        def request(method, path, **kwargs):
            response = client.request(method, "/api" + path, **kwargs)
            if not response.is_success:
                safe = response.json().get("message", "HTTP request failed")
                report["blocked"] = {"path": path, "status": response.status_code, "message": safe}
                report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
                print(f"BLOCKED {response.status_code}: {safe}", flush=True)
                raise SystemExit(2)
            return response

        credentials = {k: state[k] for k in ("email", "password")}
        request("POST", "/auth/login" if state.get("project_id") else "/auth/register", json=credentials)
        if not state.get("project_id"):
            state["project_id"] = request(
                "POST", "/projects", json={"name": f"Live verification {run_id} - AI coding education"}
            ).json()["id"]
        state_path.write_text(json.dumps(state), encoding="utf-8")
        base = "/projects/" + state["project_id"]
        report["project_id"] = state["project_id"]
        p = request("GET", base).json()
        if not p["analysis"]:
            context = p["context"]
            context.update(
                title="AI coding assistants and programming students",
                description="Investigate programming learning under guided and unsupervised AI use.",
                team_size=2,
                timeline="12 weeks",
                skills="Python and basic statistics",
                sources="Three controlled synthetic classroom studies for integration verification.",
                datasets="No student dataset access confirmed yet.",
                constraints="Small team; ethics approval and recruitment not yet available.",
            )
            request("PUT", base + "/topic", json=context)
        report["steps"].append("Project created and persisted")
        print("Calling live topic analysis through the application...", flush=True)
        request("POST", base + "/topic/analyze", json={})
        if run_id != "first-live" and not state.get("refined"):
            context = request("GET", base).json()["context"]
            context["title"] = (
                "Guided versus unsupervised AI coding assistance: programming performance and retention"
            )
            request("PUT", base + "/topic", json=context)
            request("POST", base + "/topic/analyze", json={})
            state["refined"] = True
            state_path.write_text(json.dumps(state), encoding="utf-8")
            report["steps"].append("Topic refined and reanalyzed live")
        request("POST", base + "/topic/confirm")
        report["steps"].append("Live topic analysis and confirmation")
        for file in sorted(ROOT.glob("[ABC]-*.pdf")):
            sid = request(
                "POST", base + "/sources", files={"file": (file.name, file.read_bytes(), "application/pdf")}
            ).json()["id"]
            print("Evaluating and extracting " + file.name, flush=True)
            request("POST", base + f"/sources/{sid}/process", json={})
        p = request("GET", base).json()
        for s in p["sources"]:
            pages = PdfReader(ROOT / s["filename"]).pages
            for e in s["evidence"]:
                assert e["source_id"] == s["id"]
                assert " ".join(e["quote"].split()) in " ".join(pages[e["page"] - 1].extract_text().split())
        report["verified_quotes"] = sum(len(s["evidence"]) for s in p["sources"])
        report["steps"].append("Live source evaluation/extraction and independently verified page quotations")
        request("POST", base + "/comparisons", json={})
        latest = request("GET", base).json()
        existing = next(
            (d for d in latest["drafts"] if d["title"] == "Controlled five-claim verification draft"), None
        )
        did = (
            existing["id"]
            if existing
            else request(
                "POST",
                base + "/drafts",
                json={
                    "title": "Controlled five-claim verification draft",
                    "text": (ROOT / "draft.txt").read_text(),
                },
            ).json()["id"]
        )
        request("POST", base + f"/drafts/{did}/check", json={})
        p = request("GET", base).json()
        report["steps"].append("Live comparison, claim extraction and evidence check")
        report["claims"] = p["drafts"][-1]["claims"]
        report["operation"] = p["operation"]
        (ROOT / f"{run_id}-project.json").write_text(json.dumps(p, indent=2), encoding="utf-8")
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        expected = [
            "SUPPORTED",
            "PARTIALLY_SUPPORTED",
            "CONTRADICTED",
            "UNSUPPORTED",
            "INSUFFICIENT_EVIDENCE",
        ]
        actual = [claim["check"]["status"] for claim in report["claims"]]
        assert actual == expected, f"Semantic fixture review required: {actual}"
        print("Live critical path completed; reports saved without provider credentials.", flush=True)


if __name__ == "__main__":
    main()
