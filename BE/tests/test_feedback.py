from fastapi.testclient import TestClient

from app.main import Settings, create_app
from tests.fakes import FakeAi


def register(client, email, password="correct horse battery"):
    assert client.post("/api/auth/register", json={"email": email, "password": password}).status_code == 201


def ready_project(client):
    pid = client.post("/api/projects", json={"name": "Feedback project"}).json()["id"]
    base = f"/api/projects/{pid}"
    assert client.post(base + "/topic/analyze", json={}).status_code == 200
    return pid, base


def test_ai_feedback_is_owned_deduplicated_and_not_research_content(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver"), ai=FakeAi())
    with TestClient(app) as client:
        register(client, "student@example.edu")
        pid, _ = ready_project(client)
        body = {"module": "topic_analysis", "project_id": pid, "result_id": pid, "helpful": True}
        assert client.post("/api/feedback/ai", json=body).status_code == 201
        body.update({"helpful": False, "reason": "TOO_VERBOSE", "comment": "Please be shorter."})
        assert client.post("/api/feedback/ai", json=body).status_code == 201
        with app.state.repo.connect() as db:
            row = db.execute("SELECT helpful,reason,comment,metadata FROM feedback_items").fetchone()
            assert tuple(row) == (0, "TOO_VERBOSE", "Please be shorter.", "{}")
        client.post("/api/auth/logout")
        register(client, "other@example.edu")
        assert client.post("/api/feedback/ai", json=body).status_code == 404


def test_product_feedback_and_admin_review(tmp_path):
    settings = Settings(data_dir=tmp_path, initial_admin_email="admin@example.edu", allowed_origins="http://testserver", allowed_hosts="testserver")
    app = create_app(settings, ai=FakeAi())
    with TestClient(app) as client:
        register(client, "student@example.edu")
        response = client.post("/api/feedback", json={"type": "BUG", "comment": "Button does not respond", "metadata": {"route": "/hub", "platform": "web", "unsafe": "ignored"}})
        assert response.status_code == 201
        assert response.json()["metadata"] == {"route": "/hub", "platform": "web"}
        client.post("/api/auth/logout")
        register(client, "admin@example.edu")
        feedback = client.get("/api/admin/feedback?category=bug")
        assert feedback.status_code == 200 and len(feedback.json()["items"]) == 1
        item = feedback.json()["items"][0]
        assert client.patch(f"/api/admin/feedback/{item['id']}", json={"status": "RESOLVED"}).json()["status"] == "RESOLVED"
        assert client.get("/api/admin/feedback?category=negative").json()["summary"]["helpful_rate"] is None
