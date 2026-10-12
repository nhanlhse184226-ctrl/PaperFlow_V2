from fastapi.testclient import TestClient

from app.application.models import uid
from app.application.services import AuthService
from app.main import Settings, create_app
from app.seed_demo import ensure_account, grant_pro
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


def test_admin_monthly_report_filters_revenue_and_excludes_demo_grants(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver",
                              initial_admin_email="admin@example.edu"), ai=FakeAi(), payment_gateway=FakePayOS())
    with TestClient(app) as client:
        register(client, "admin@example.edu")
        current = client.get("/api/auth/me").json()
        project_id = client.post("/api/projects", json={"name": "Reporting project"}).json()["id"]

        def paid(code, month, amount, reference="bank"):
            stamp = f"{month}-15T12:00:00+00:00"
            app.state.repo.create_billing_order({
                "id": uid(), "order_code": code, "user_id": current["id"], "project_id": project_id,
                "project_name": "Reporting project", "plan_id": "pro", "plan_name": "Pro", "amount": amount,
                "status": "PAID", "payment_link_id": "test", "checkout_url": None,
                "created_at": stamp, "paid_at": stamp, "provider_reference": reference,
            })

        paid(700_000_000_001, "2026-01", 39_000)
        paid(700_000_000_002, "2026-02", 99_000)
        paid(700_000_000_003, "2026-02", 99_000, "DEMO_GRANT")
        response = client.get("/api/admin/overview?month=2026-02")
        assert response.status_code == 200
        report = response.json()
        assert report["revenue"] == 138_000
        assert report["paid_orders"] == 2
        assert report["selected_month"] == "2026-02"
        assert report["month_revenue"] == 99_000
        assert report["month_orders"] == 1
        assert [item["month"] for item in report["months"]] == ["2026-01", "2026-02"]
        assert client.get("/api/admin/overview?month=2026-13").status_code == 422


def test_demo_seed_grants_pro_without_counting_as_revenue(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, allowed_hosts="testserver"), ai=FakeAi(), payment_gateway=FakePayOS())
    repo = app.state.repo
    auth = AuthService(repo)
    admin = ensure_account(repo, auth, "admin@example.edu", password="admin-pass", admin=True)
    user = ensure_account(repo, auth, "user@example.edu", password="user-pass")
    assert repo.user("admin@example.edu")["role"] == "ADMIN"
    for account in (admin, user):
        _, created = grant_pro(repo, account)
        assert created is True
        _, created_again = grant_pro(repo, account)
        assert created_again is False
        project = next(item for item in repo.list(account) if item.name == "Demo Pro Workspace")
        assert repo.project_billing_state(account, project.id)["plan_id"] == "pro"
    assert repo.billing_overview()["revenue"] == 0
    assert repo.billing_overview()["paid_orders"] == 0
