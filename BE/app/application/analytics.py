"""Web-only usage analytics with server-authoritative business metrics."""

from .models import AppError, now, uid


EVENTS = {
    "page_view", "login", "sign_up", "project_create", "source_upload", "topic_check_complete",
    "evidence_matrix_open", "essay_check_complete", "begin_checkout",
}
PROJECT_EVENTS = {
    "project_create", "source_upload", "topic_check_complete", "evidence_matrix_open",
    "essay_check_complete", "begin_checkout",
}


class AnalyticsService:
    def __init__(self, repo):
        self.repo = repo

    def track(self, user_id: str, event_name: str, project_id: str | None = None):
        if event_name not in EVENTS:
            raise AppError("Sự kiện phân tích không hợp lệ.", 422)
        if event_name in PROJECT_EVENTS and not project_id:
            raise AppError("Sự kiện này cần dự án hợp lệ.", 422)
        if project_id:
            # Ownership is checked server-side; the browser never supplies a user identity.
            self.repo.get(user_id, project_id)
        self.repo.record_web_event({
            "id": uid(), "user_id": user_id, "project_id": project_id,
            "event_name": event_name, "occurred_at": now(),
        })
        return {"ok": True}

    def overview(self, days: int):
        if days not in (7, 30, 90):
            raise AppError("Khoảng thời gian phải là 7, 30 hoặc 90 ngày.", 422)
        return self.repo.analytics_overview(days)

    def paid_users_csv(self):
        return self.repo.paid_users_export()
