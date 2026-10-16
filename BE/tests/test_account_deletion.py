from fastapi.testclient import TestClient

from app.main import Settings, create_app
from tests.fakes import FakeAi, pdf_bytes


def test_account_deletion_removes_only_owned_data_and_source_files(tmp_path):
    app = create_app(
        Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver"),
        ai=FakeAi(),
    )
    with TestClient(app) as client:
        assert client.post("/api/auth/register", json={"email": "owner@example.edu", "password": "safe password"}).status_code == 201
        owner_id = client.get("/api/auth/me").json()["id"]
        project_id = client.post("/api/projects", json={"name": "Account deletion"}).json()["id"]
        upload = client.post(
            f"/api/projects/{project_id}/sources",
            files={"file": ("private.pdf", pdf_bytes(), "application/pdf")},
        )
        assert upload.status_code == 201
        source_id = upload.json()["id"]
        assert client.post("/api/hub", json={"topic": "Private topic", "note": "A note that belongs to the owner."}).status_code == 201
        assert client.post("/api/feedback", json={"type": "BUG", "comment": "Owned feedback"}).status_code == 201
        with app.state.repo.connect() as db:
            db.execute(
                "INSERT INTO billing_orders (id,order_code,user_id,plan_id,plan_name,amount,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
                ("owned-order", 900001, owner_id, "pro", "Pro", 99000, "PAID", "2026-10-14T00:00:00Z"),
            )
        assert client.post("/api/auth/logout").status_code == 200

        assert client.post("/api/auth/register", json={"email": "other@example.edu", "password": "safe password"}).status_code == 201
        other_id = client.get("/api/auth/me").json()["id"]
        other_project = client.post("/api/projects", json={"name": "Other account"}).json()["id"]
        assert client.post("/api/auth/logout").status_code == 200

        assert client.post("/api/auth/login", json={"email": "owner@example.edu", "password": "safe password"}).status_code == 200
        assert client.delete("/api/auth/me").status_code == 200
        assert client.get("/api/auth/me").status_code == 401
        assert not (tmp_path / "uploads" / f"{source_id}.pdf").exists()

        with app.state.repo.connect() as db:
            assert db.execute("SELECT COUNT(*) AS count FROM users WHERE id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM projects WHERE owner_id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM notes WHERE owner_id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM feedback_items WHERE user_id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM billing_orders WHERE user_id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM sessions WHERE user_id=?", (owner_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT COUNT(*) AS count FROM users WHERE id=?", (other_id,)).fetchone()["count"] == 1
            assert db.execute("SELECT COUNT(*) AS count FROM projects WHERE id=?", (other_project,)).fetchone()["count"] == 1
