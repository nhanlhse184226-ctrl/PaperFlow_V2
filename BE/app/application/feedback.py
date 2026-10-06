from .models import AppError, now, uid
from .ports import Repository


AI_MODULES = {"topic_analysis", "source_evaluation", "compare_sources", "essay_evidence_check"}
REASONS = {"INCORRECT", "MISSING_INFORMATION", "CITATION_EVIDENCE", "TOO_VERBOSE", "OTHER"}
PRODUCT_TYPES = {"BUG", "SUGGESTION", "OTHER"}
STATUSES = {"NEW", "REVIEWED", "RESOLVED"}


class FeedbackService:
    """Stores product signals only; research content never enters this boundary."""

    def __init__(self, repo: Repository):
        self.repo = repo

    def _target(self, user_id, module, project_id, result_id):
        if module not in AI_MODULES:
            raise AppError("Feedback module is not supported.")
        project = self.repo.get(user_id, project_id)
        if module in {"topic_analysis", "compare_sources"} and result_id != project.id:
            raise AppError("Feedback target does not match this project.", 400)
        if module == "topic_analysis" and not project.analysis:
            raise AppError("Topic analysis not found.", 404)
        if module == "compare_sources" and not project.comparisons:
            raise AppError("Source comparison not found.", 404)
        if module == "source_evaluation" and not any(s.id == result_id and s.evaluation for s in project.sources):
            raise AppError("Source evaluation not found.", 404)
        if module == "essay_evidence_check" and not any(d.id == result_id and d.claims for d in project.drafts):
            raise AppError("Evidence check not found.", 404)

    def submit_ai(self, user_id, module, project_id, result_id, helpful, reason=None, comment=""):
        self._target(user_id, module, project_id, result_id)
        if reason and reason not in REASONS:
            raise AppError("Feedback reason is not supported.")
        if helpful:
            reason, comment = None, ""
        elif not reason:
            raise AppError("Choose what went wrong before sending feedback.")
        item = {
            "id": uid(), "user_id": user_id, "kind": "AI", "module": module,
            "result_id": result_id, "project_id": project_id, "helpful": int(helpful),
            "reason": reason, "product_type": None, "comment": comment[:1000],
            "metadata": {}, "status": "NEW", "created_at": now(), "updated_at": now(),
        }
        return self.repo.upsert_ai_feedback(item)

    def submit_product(self, user_id, product_type, comment, metadata=None):
        if product_type not in PRODUCT_TYPES:
            raise AppError("Feedback type is not supported.")
        if not comment.strip():
            raise AppError("Describe the issue or suggestion before sending feedback.")
        metadata = metadata or {}
        # Only a deliberately supplied, non-research diagnostics allow-list is retained.
        safe_metadata = {key: str(metadata[key])[:300] for key in ("route", "platform", "app_version") if key in metadata and metadata[key]}
        item = {
            "id": uid(), "user_id": user_id, "kind": "PRODUCT", "module": None,
            "result_id": None, "project_id": None, "helpful": None, "reason": None,
            "product_type": product_type, "comment": comment.strip()[:3000],
            "metadata": safe_metadata, "status": "NEW", "created_at": now(), "updated_at": now(),
        }
        return self.repo.create_feedback(item)

    def summary(self):
        return self.repo.feedback_summary()

    def list(self, category="all", status=None):
        return self.repo.feedback_list(category, status)

    def detail(self, feedback_id):
        item = self.repo.feedback_item(feedback_id)
        if not item:
            raise AppError("Feedback not found.", 404)
        return item

    def set_status(self, feedback_id, status):
        if status not in STATUSES:
            raise AppError("Feedback status is not supported.")
        if not self.repo.update_feedback_status(feedback_id, status, now()):
            raise AppError("Feedback not found.", 404)
        return self.detail(feedback_id)
