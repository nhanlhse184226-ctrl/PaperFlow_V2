"""Create the user-authorized demo accounts and grant a clearly marked Pro workspace.

Run only from a trusted deployment shell. The grant is intentionally excluded
from sales reporting; it does not simulate a completed bank transfer.
"""

import argparse
import secrets

from app.application.billing import PLANS
from app.application.models import Context, Project, now, uid
from app.application.services import AuthService
from app.infrastructure.postgres_repository import PostgresRepository
from app.infrastructure.repository import SqliteRepository
from app.main import Settings

DEMO_PROJECT = "Demo Pro Workspace"
DEMO_REFERENCE = "DEMO_GRANT"


def repository(settings):
    return PostgresRepository(settings.database_url, True) if settings.database_url else SqliteRepository(
        settings.data_dir / "paperflow.db", True
    )


def ensure_account(repo, auth, email, password=None, admin=False):
    email = email.strip().lower()
    user = repo.user(email)
    if not user:
        if not password:
            raise ValueError(f"Password is required when creating {email}.")
        user_id = repo.register(email, auth.password_hash(password), "ADMIN" if admin else "USER")
        return user_id
    if password:
        repo.set_password(email, auth.password_hash(password))
    if admin:
        repo.set_role(email, "ADMIN")
    return user["id"]


def grant_pro(repo, user_id):
    project = next((item for item in repo.list(user_id) if item.name == DEMO_PROJECT), None)
    if project is None:
        project = Project(owner_id=user_id, name=DEMO_PROJECT, context=Context(title=DEMO_PROJECT))
        repo.create(project)
    if any(order["project_id"] == project.id and order["status"] == "PAID" and order["plan_id"] == "pro" for order in repo.billing_orders(user_id)):
        return project.name, False
    plan = PLANS["pro"]
    repo.create_billing_order({
        "id": uid(), "order_code": secrets.randbits(50) + (1 << 49), "user_id": user_id,
        "project_id": project.id, "project_name": project.name, "plan_id": plan.id,
        "plan_name": "Pro · Demo", "amount": plan.amount, "status": "PAID",
        "payment_link_id": "demo-grant", "checkout_url": None, "created_at": now(),
        "paid_at": now(), "provider_reference": DEMO_REFERENCE,
    })
    return project.name, True


def main():
    parser = argparse.ArgumentParser(description="Seed PaperFlow demo accounts without recording revenue.")
    parser.add_argument("--user-email", required=True)
    parser.add_argument("--user-password", required=True)
    parser.add_argument("--admin-email", required=True)
    parser.add_argument("--admin-password")
    args = parser.parse_args()
    settings = Settings()
    repo = repository(settings)
    auth = AuthService(repo, settings.initial_admin_email)
    admin_id = ensure_account(repo, auth, args.admin_email, password=args.admin_password, admin=True)
    user_id = ensure_account(repo, auth, args.user_email, password=args.user_password)
    admin_project, admin_granted = grant_pro(repo, admin_id)
    user_project, user_granted = grant_pro(repo, user_id)
    print({"admin": {"project": admin_project, "granted": admin_granted}, "user": {"project": user_project, "granted": user_granted}})


if __name__ == "__main__":
    main()
