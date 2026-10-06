from fastapi.testclient import TestClient

from app.application.models import AppError
from app.main import Settings, create_app


class FakeGoogleIdentity:
    def verify(self, credential):
        if credential != "google-id-token-for-student":
            raise AppError("Google could not verify this sign-in.", 401)
        return "student@example.edu"


def test_google_sign_in_uses_existing_session_model(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        allowed_origins="http://testserver",
        allowed_hosts="testserver",
        google_oauth_client_id="web-client.apps.googleusercontent.com",
    )
    app = create_app(settings, google_identity=FakeGoogleIdentity())
    with TestClient(app) as client:
        assert client.get("/api/auth/google/config").json() == {
            "enabled": True,
            "client_id": "web-client.apps.googleusercontent.com",
        }
        response = client.post(
            "/api/auth/google", json={"credential": "google-id-token-for-student"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "student@example.edu"
        assert client.get("/api/auth/me").json()["email"] == "student@example.edu"
        assert client.post("/api/auth/logout").status_code == 200
        assert client.post(
            "/api/auth/google", json={"credential": "invalid-google-id-token"}
        ).status_code == 401


def test_google_sign_in_is_hidden_when_not_configured(tmp_path):
    app = create_app(
        Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver")
    )
    with TestClient(app) as client:
        assert client.get("/api/auth/google/config").json() == {
            "enabled": False,
            "client_id": "",
        }
