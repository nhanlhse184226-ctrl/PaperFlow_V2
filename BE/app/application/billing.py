"""Billing is deliberately separate from research workspace aggregates.

The only trusted transition to PAID is a signature-verified PayOS webhook.
Return URLs are UX only and never activate a plan.
"""

import secrets
from dataclasses import asdict, dataclass

from .models import AppError, now, uid


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    amount: int
    tagline: str
    highlights: tuple[str, ...]
    sources: int
    drafts: int


PLANS = {
    "starter": Plan("starter", "Starter", 39000, "Một dự án, một lần thanh toán", ("5 tài liệu PDF", "1 bản thảo", "Đối chiếu bằng chứng"), 5, 1),
    "research": Plan("research", "Research", 79000, "Thêm nguồn cho một dự án", ("15 tài liệu PDF", "3 bản thảo", "Đối chiếu bằng chứng"), 15, 3),
    "pro": Plan("pro", "Pro", 99000, "Không gian lớn cho một dự án", ("30 tài liệu PDF", "20 bản thảo", "Đối chiếu bằng chứng"), 30, 20),
}
FREE_SOURCES = 1
FREE_DRAFTS = 1
PLAN_RANK = {"free": 0, "starter": 1, "research": 2, "pro": 3}


def public_plans():
    return [asdict(plan) for plan in PLANS.values()]


def project_limits(state: dict):
    if not state["billing_enforced"]:
        return None
    plan = PLANS.get(state["plan_id"])
    return (plan.sources, plan.drafts) if plan else (FREE_SOURCES, FREE_DRAFTS)


class BillingService:
    def __init__(self, repo, gateway, return_url: str, cancel_url: str):
        self.repo, self.gateway = repo, gateway
        self.return_url, self.cancel_url = return_url, cancel_url

    def plans(self):
        return public_plans()

    def create_checkout(self, user_id: str, project_id: str, plan_id: str):
        plan = PLANS.get(plan_id)
        if not plan:
            raise AppError("Gói dịch vụ không hợp lệ.", 404)
        if not self.gateway.configured:
            raise AppError("Thanh toán PayOS chưa được cấu hình. Vui lòng thử lại sau.", 503)
        project = self.repo.get(user_id, project_id)
        state = self.repo.project_billing_state(user_id, project_id)
        if not state["billing_enforced"]:
            raise AppError("Dự án này đã có quyền sử dụng đầy đủ; không cần mua gói.", 409)
        if PLAN_RANK[plan_id] <= PLAN_RANK[state["plan_id"]]:
            raise AppError("Dự án đã có gói tương đương hoặc cao hơn.", 409)
        for existing in self.repo.billing_orders(user_id):
            if existing["project_id"] == project_id and existing["status"] == "PENDING":
                if existing["plan_id"] == plan_id and existing["checkout_url"]:
                    return {"order_code": existing["order_code"], "checkout_url": existing["checkout_url"], "qr_code": ""}
                raise AppError("Dự án có giao dịch chưa hoàn tất. Vui lòng hoàn tất hoặc hủy giao dịch đó trước.", 409)
        # Random 50-bit code is below JavaScript's safe-integer maximum.
        order_code = secrets.randbits(50) + (1 << 49)
        order = {
            "id": uid(), "order_code": order_code, "user_id": user_id,
            "project_id": project_id, "project_name": project.name,
            "plan_id": plan.id, "plan_name": plan.name, "amount": plan.amount,
            "status": "PENDING", "created_at": now(), "paid_at": None,
            "payment_link_id": None, "checkout_url": None, "provider_reference": None,
        }
        self.repo.create_billing_order(order)
        try:
            payment = self.gateway.create(order_code, plan.amount, f"PF{plan.amount // 1000}", self.return_url, self.cancel_url)
        except Exception:
            self.repo.update_billing_order(order_code, status="CANCELLED")
            raise AppError("Không tạo được liên kết thanh toán. Vui lòng thử lại.", 502) from None
        self.repo.update_billing_order(order_code, payment_link_id=payment["payment_link_id"], checkout_url=payment["checkout_url"])
        return {"order_code": order_code, "checkout_url": payment["checkout_url"], "qr_code": payment.get("qr_code", "")}

    def webhook(self, raw: bytes):
        try:
            event = self.gateway.verify(raw)
        except Exception:
            raise AppError("Webhook PayOS không hợp lệ.", 400) from None
        order = self.repo.billing_order(int(event["order_code"]))
        if not order:
            # A valid payment for a different merchant order must not affect this app.
            return {"ok": True}
        if (event.get("code") != "00" or int(event.get("amount", 0)) != order["amount"]
                or event.get("currency") != "VND"
                or (order["payment_link_id"] and event.get("payment_link_id") != order["payment_link_id"])):
            return {"ok": True}
        self.repo.mark_billing_paid(order["order_code"], now(), str(event.get("reference", ""))[:200])
        return {"ok": True}

    def mine(self, user_id: str):
        projects = self.repo.list(user_id)
        return {"plans": self.plans(), "orders": self.repo.billing_orders(user_id),
                "projects": [{"id": p.id, "name": p.name, **self.repo.project_billing_state(user_id, p.id)} for p in projects]}

    def refresh_order(self, user_id: str, order_code: int):
        order = self.repo.billing_order(order_code)
        if not order or order["user_id"] != user_id:
            raise AppError("Không tìm thấy đơn hàng.", 404)
        if order["status"] == "PENDING" and order["payment_link_id"] and self.gateway.configured:
            try:
                provider_status = self.gateway.status(order_code)
            except Exception:
                raise AppError("Chưa kiểm tra được trạng thái PayOS. Vui lòng thử lại.", 502) from None
            if provider_status in ("CANCELLED", "EXPIRED"):
                self.repo.mark_billing_cancelled(order_code, provider_status)
        return self.repo.billing_order(order_code)

    def overview(self):
        return self.repo.billing_overview()
