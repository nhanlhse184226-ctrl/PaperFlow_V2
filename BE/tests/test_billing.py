from fastapi.testclient import TestClient

from app.application.models import now, uid
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


def test_admin_analytics_reports_real_payments_and_web_events(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, allowed_origins="http://testserver", allowed_hosts="testserver",
                              initial_admin_email="admin@example.edu"), ai=FakeAi(), payment_gateway=FakePayOS())
    with TestClient(app) as client:
        register(client, "admin@example.edu")
        current = client.get("/api/auth/me").json()
        project_id = client.post("/api/projects", json={"name": "Reporting project"}).json()["id"]
        stamp = now()
        app.state.repo.create_billing_order({
            "id": uid(), "order_code": 700_000_000_001, "user_id": current["id"], "project_id": project_id,
            "project_name": "Reporting project", "plan_id": "pro", "plan_name": "Pro", "amount": 99_000,
            "status": "PAID", "payment_link_id": "test", "checkout_url": None,
            "created_at": stamp, "paid_at": stamp, "provider_reference": "bank",
        })
        app.state.repo.create_billing_order({
            "id": uid(), "order_code": 700_000_000_002, "user_id": current["id"], "project_id": project_id,
            "project_name": "Reporting project", "plan_id": "pro", "plan_name": "Pro", "amount": 99_000,
            "status": "PAID", "payment_link_id": "demo", "checkout_url": None,
            "created_at": stamp, "paid_at": stamp, "provider_reference": "DEMO_GRANT",
        })
        assert client.post("/api/analytics/events", json={"name": "page_view"}).status_code == 201
        assert client.post("/api/analytics/events", json={"name": "source_upload", "project_id": project_id}).status_code == 201
        report = client.get("/api/admin/overview?days=30").json()
        # The established Flutter contract remains at the top level.
        assert report["revenue"] == 99_000
        assert report["paid_orders"] == 1
        assert report["customers"] == 1
        assert report["pending_orders"] == 0
        assert {"trend", "months", "selected_month", "month_trend", "month_revenue", "month_orders", "recent_orders"} <= set(report)
        # Web-only analytics is additive and cannot collide with existing keys.
        assert report["analytics"]["revenue"] == 99_000
        assert report["analytics"]["successful_transactions"] == 1
        assert report["analytics"]["paid_users"] == 1
        assert report["analytics"]["active_users"] == 1
        assert report["analytics"]["mau"] == 1
        assert report["analytics"]["total_users"] == 1
        assert report["analytics"]["new_users"] == 1
        assert report["analytics"]["period"]["kind"] == "days"
        assert report["analytics"]["conversion_rate"] is None
        assert {item["event_name"] for item in report["analytics"]["features"]} == {"page_view", "source_upload"}
        month_report = client.get(f"/api/admin/overview?days=30&month={stamp[:7]}")
        assert month_report.status_code == 200
        assert month_report.json()["analytics"]["period"]["kind"] == "month"
        assert month_report.json()["analytics"]["revenue"] == 99_000
        assert client.get("/api/admin/overview?days=30&month=2026-13").status_code == 422
        assert client.get("/api/admin/overview?days=14").status_code == 422
        assert client.post("/api/analytics/events", json={"name": "source_upload", "project_id": "not-owned"}).status_code == 404
        client.post("/api/auth/logout")
        register(client, "member@example.edu")
        assert client.get("/api/admin/overview?days=30").status_code == 403
        client.post("/api/auth/logout")
        assert client.post("/api/auth/login", json={"email": "admin@example.edu", "password": "correct horse battery"}).status_code == 200
        csv = client.get("/api/admin/paid-users.csv")
        assert csv.status_code == 200
        assert "admin@example.edu" in csv.text


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


def test_configured_demo_account_receives_paid_pro_for_every_project(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        allowed_origins="http://testserver",
        allowed_hosts="testserver",
        demo_pro_emails="demo@example.edu",
    )
    app = create_app(settings, ai=FakeAi(), payment_gateway=FakePayOS())
    with TestClient(app) as client:
        register(client, "demo@example.edu")
        project_id = client.post("/api/projects", json={"name": "Current demo project"}).json()["id"]
        billing = client.get("/api/billing/me").json()
        states = {item["id"]: item["plan_id"] for item in billing["projects"]}
        assert states[project_id] == "pro"
        assert all(item["plan_id"] == "pro" for item in billing["projects"])
        assert all(order["status"] == "PAID" for order in billing["orders"])
        assert app.state.repo.billing_overview()["revenue"] == 0
