from fastapi.testclient import TestClient

from app.main import Settings, create_app
from tests.fakes import FakeAi, QUOTE, pdf_bytes


class FakePayOS:
    configured = True

    def __init__(self):
        self.order_code = None
        self.amount = None
        self.description = None
        self.provider_status = "PENDING"
        self.valid = True

    def create(self, order_code, amount, description, return_url, cancel_url):
        self.order_code, self.amount, self.description = order_code, amount, description
        return {"payment_link_id": "payos-link", "checkout_url": "https://pay.payos.vn/web/example"}

    def verify(self, raw):
        if raw != b"signed" or not self.valid:
            raise ValueError("Invalid signature")
        return {"order_code": self.order_code, "amount": self.amount, "code": "00",
                "currency": "VND", "payment_link_id": "payos-link", "reference": "bank-reference"}

    def status(self, order_code):
        assert order_code == self.order_code
        return self.provider_status


def register(client, email):
    response = client.post("/api/auth/register", json={"email": email, "password": "correct horse battery"})
    assert response.status_code == 201, response.text


def test_project_purchase_enforces_caps_and_webhook_is_idempotent(tmp_path):
    gateway = FakePayOS()
    app = create_app(Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver"),
                     ai=FakeAi(), payment_gateway=gateway)
    with TestClient(app) as client:
        register(client, "owner@example.edu")
        pid = client.post("/api/projects", json={"name": "First project"}).json()["id"]
        base = f"/api/projects/{pid}"
        state = client.get("/api/billing/me").json()["projects"][0]
        assert state["billing_enforced"] is True
        assert state["plan_id"] == "free"
        assert client.post(base + "/sources", files={"file": ("a.pdf", pdf_bytes(QUOTE), "application/pdf")}).status_code == 201
        second = {"file": ("b.pdf", pdf_bytes(QUOTE + " A second source."), "application/pdf")}
        assert client.post(base + "/sources", files=second).status_code == 403
        assert client.post(base + "/drafts", json={"title": "One", "text": QUOTE}).status_code == 201
        assert client.post(base + "/drafts", json={"title": "Two", "text": QUOTE}).status_code == 403

        checkout = client.post("/api/billing/checkout", json={"project_id": pid, "plan_id": "starter"})
        assert checkout.status_code == 200
        code = checkout.json()["order_code"]
        assert checkout.json()["checkout_url"].startswith("https://pay.payos.vn/")
        assert client.post("/api/billing/checkout", json={"project_id": pid, "plan_id": "starter"}).json()["order_code"] == code
        assert client.post("/api/billing/checkout", json={"project_id": pid, "plan_id": "research"}).status_code == 409
        assert len(gateway.description) <= 9
        assert client.post("/api/billing/payos/webhook", content=b"invalid").status_code == 400
        assert client.get("/api/billing/me").json()["projects"][0]["plan_id"] == "free"
        assert client.post("/api/billing/payos/webhook", content=b"signed").status_code == 200
        paid = app.state.repo.billing_order(code)
        assert paid["status"] == "PAID"
        assert paid["project_id"] == pid
        assert client.post("/api/billing/payos/webhook", content=b"signed").status_code == 200
        assert app.state.repo.billing_order(code)["paid_at"] == paid["paid_at"]
        assert client.get("/api/billing/me").json()["projects"][0]["plan_id"] == "starter"
        assert client.post(base + "/sources", files=second).status_code == 201
        assert client.post("/api/billing/checkout", json={"project_id": pid, "plan_id": "starter"}).status_code == 409


def test_billing_owner_and_legacy_project_are_preserved(tmp_path):
    settings = Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver")
    old_app = create_app(settings.model_copy(update={"payos_client_id": "", "payos_api_key": "", "payos_checksum_key": ""}), ai=FakeAi())
    with TestClient(old_app) as client:
        register(client, "legacy@example.edu")
        legacy = client.post("/api/projects", json={"name": "Legacy"}).json()["id"]

    gateway = FakePayOS()
    app = create_app(settings, ai=FakeAi(), payment_gateway=gateway)
    with TestClient(app) as client:
        assert client.post("/api/auth/login", json={"email": "legacy@example.edu", "password": "correct horse battery"}).status_code == 200
        assert client.get("/api/billing/me").json()["projects"][0]["billing_enforced"] is False
        assert client.post("/api/billing/checkout", json={"project_id": legacy, "plan_id": "pro"}).status_code == 409
        new = client.post("/api/projects", json={"name": "New"}).json()["id"]
        checkout = client.post("/api/billing/checkout", json={"project_id": new, "plan_id": "research"})
        assert checkout.status_code == 200
        code = checkout.json()["order_code"]
        gateway.provider_status = "PAID"
        assert client.post(f"/api/billing/orders/{code}/refresh").json()["status"] == "PENDING"
        client.post("/api/auth/logout")
        register(client, "stranger@example.edu")
        assert client.post("/api/billing/checkout", json={"project_id": new, "plan_id": "pro"}).status_code == 404
        assert client.post(f"/api/billing/orders/{code}/refresh").status_code == 404
