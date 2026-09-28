"""Read-only deployment checks plus a deliberately invalid login; no AI calls."""

import re
import sys

import httpx

origin = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
with httpx.Client(base_url=origin, timeout=20) as client:
    health = client.get("/api/health")
    assert health.status_code == 200 and health.json()["status"] == "ok"
    print("Health: OK; Gemini configured:", health.json()["ai_configured"])
    home = client.get("/")
    assert home.status_code == 200 and "PaperFlow" in home.text
    assert "Content-Security-Policy" in home.headers
    for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"', home.text):
        response = client.get(asset)
        assert response.status_code == 200
    assert client.get("/projects/not-a-real-project/topic").status_code == 200
    assert client.get("/api/projects").status_code == 401
    credentials = {
        "email": "does-not-exist@example.invalid",
        "password": "invalid test password",
    }
    assert (
        client.post(
            "/api/auth/login", json=credentials, headers={"Origin": origin}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json=credentials,
            headers={"Origin": "https://untrusted.invalid"},
        ).status_code
        == 403
    )
    print(
        "SPA routes, built assets, security headers, authentication, and origin checks: OK"
    )
