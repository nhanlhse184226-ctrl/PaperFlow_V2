from collections import defaultdict, deque
import time
from threading import Lock
from typing import Literal

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import Field

from app.application.models import AppError, Context, Model


class Credentials(Model):
    email: str = Field(max_length=254)
    password: str = Field(min_length=3, max_length=128)


class Name(Model):
    name: str = Field(min_length=3, max_length=200)


class Run(Model):
    force: bool = False


class Translation(Model):
    language: Literal["en", "vi"]


class Selection(Run):
    source_ids: list[str] = Field(default_factory=list, max_length=30)


class DraftInput(Model):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=20, max_length=60000)


class NoteInput(Model):
    topic: str = Field(min_length=3, max_length=300)
    note: str = Field(min_length=10, max_length=3000)


class CheckoutInput(Model):
    project_id: str = Field(min_length=1, max_length=100)
    plan_id: Literal["starter", "research", "pro"]


class AiFeedbackInput(Model):
    module: Literal["topic_analysis", "source_evaluation", "compare_sources", "essay_evidence_check"]
    project_id: str = Field(min_length=1, max_length=100)
    result_id: str = Field(min_length=1, max_length=100)
    helpful: bool
    reason: Literal["INCORRECT", "MISSING_INFORMATION", "CITATION_EVIDENCE", "TOO_VERBOSE", "OTHER"] | None = None
    comment: str = Field(default="", max_length=1000)


class ProductFeedbackInput(Model):
    type: Literal["BUG", "SUGGESTION", "OTHER"]
    comment: str = Field(min_length=3, max_length=3000)
    metadata: dict[str, str] = Field(default_factory=dict, max_length=3)


class FeedbackStatusInput(Model):
    status: Literal["NEW", "REVIEWED", "RESOLVED"]


def create_router(service, auth, settings, billing=None, feedback=None):
    router = APIRouter(prefix="/api")
    attempts = defaultdict(deque)
    guard = Lock()

    def user(request: Request):
        return auth.authenticate(request.cookies.get("paperflow_session", ""))

    def owner(current=Depends(user)):
        return current["id"]

    def admin(current=Depends(user)):
        if current.get("role") != "ADMIN":
            raise AppError("Bạn không có quyền truy cập trang quản trị.", 403)
        return current

    @router.get("/health")
    def health():
        return {
            "status": "ok",
            "ai_provider": settings.ai_provider,
            "ai_configured": settings.ai_provider == "ollama" or bool(settings.gemini_api_key),
        }

    def establish(credentials, request, response, register):
        address = request.client.host if request.client else "unknown"
        with guard:
            cutoff = time.monotonic() - 300
            for key in list(attempts):
                while attempts[key] and attempts[key][0] < cutoff:
                    attempts[key].popleft()
                if not attempts[key]:
                    del attempts[key]
            if len(attempts[address]) >= 20:
                raise AppError("Too many sign-in attempts. Wait five minutes.", 429)
            attempts[address].append(time.monotonic())
        token, current = auth.login(credentials.email, credentials.password, register)
        response.set_cookie(
            "paperflow_session",
            token,
            max_age=604800,
            httponly=True,
            secure=settings.secure_cookies,
            samesite=settings.cookie_samesite,
            path="/",
        )
        return current

    @router.post("/auth/register", status_code=201)
    def register(body: Credentials, request: Request, response: Response):
        return establish(body, request, response, True)

    @router.post("/auth/login")
    def login(body: Credentials, request: Request, response: Response):
        return establish(body, request, response, False)

    @router.get("/auth/me")
    def me(current=Depends(user)):
        return current

    @router.post("/auth/logout")
    def logout(request: Request, response: Response):
        auth.logout(request.cookies.get("paperflow_session", ""))
        response.delete_cookie(
            "paperflow_session",
            path="/",
            secure=settings.secure_cookies,
            samesite=settings.cookie_samesite,
        )
        return {"ok": True}

    @router.get("/billing/plans")
    def plans():
        return billing.plans()

    @router.get("/billing/me")
    def my_billing(current=Depends(user)):
        return billing.mine(current["id"])

    @router.post("/billing/checkout")
    def checkout(body: CheckoutInput, current=Depends(user)):
        return billing.create_checkout(current["id"], body.project_id, body.plan_id)

    @router.post("/billing/orders/{order_code}/refresh")
    def refresh_order(order_code: int, current=Depends(user)):
        return billing.refresh_order(current["id"], order_code)

    @router.post("/billing/payos/webhook")
    async def payos_webhook(request: Request):
        return billing.webhook(await request.body())

    @router.get("/admin/overview")
    def admin_overview(current=Depends(admin)):
        return billing.overview()

    @router.post("/feedback/ai", status_code=201)
    def ai_feedback(body: AiFeedbackInput, current=Depends(user)):
        return feedback.submit_ai(current["id"], body.module, body.project_id, body.result_id, body.helpful, body.reason, body.comment)

    @router.post("/feedback", status_code=201)
    def product_feedback(body: ProductFeedbackInput, current=Depends(user)):
        return feedback.submit_product(current["id"], body.type, body.comment, body.metadata)

    @router.get("/admin/feedback")
    def admin_feedback(category: Literal["all", "negative", "bug", "suggestion"] = "all", status: Literal["NEW", "REVIEWED", "RESOLVED"] | None = None, current=Depends(admin)):
        return {"summary": feedback.summary(), "items": feedback.list(category, status)}

    @router.get("/admin/feedback/{feedback_id}")
    def admin_feedback_detail(feedback_id: str, current=Depends(admin)):
        return feedback.detail(feedback_id)

    @router.patch("/admin/feedback/{feedback_id}")
    def admin_feedback_status(feedback_id: str, body: FeedbackStatusInput, current=Depends(admin)):
        return feedback.set_status(feedback_id, body.status)

    @router.get("/projects")
    def projects(oid=Depends(owner)):
        return service.list(oid)

    @router.post("/projects", status_code=201)
    def create(body: Name, oid=Depends(owner)):
        return {"id": service.create(oid, body.name).id}

    @router.get("/projects/{pid}")
    def project(pid: str, oid=Depends(owner)):
        return service.get(oid, pid)

    @router.patch("/projects/{pid}")
    def rename(pid: str, body: Name, oid=Depends(owner)):
        service.rename(oid, pid, body.name)
        return {"ok": True}

    @router.delete("/projects/{pid}")
    def delete(pid: str, oid=Depends(owner)):
        service.delete(oid, pid)
        return {"ok": True}

    @router.put("/projects/{pid}/topic")
    def topic(pid: str, body: Context, oid=Depends(owner)):
        service.topic(oid, pid, body)
        return {"ok": True}

    @router.post("/projects/{pid}/topic/analyze")
    def analyze(pid: str, body: Run, oid=Depends(owner)):
        service.analyze(oid, pid, body.force)
        return {"ok": True}

    @router.post("/projects/{pid}/topic/translation")
    def translate_topic(pid: str, body: Translation, oid=Depends(owner)):
        return service.translated_topic(oid, pid, body.language)

    @router.post("/projects/{pid}/topic/confirm")
    def confirm(pid: str, oid=Depends(owner)):
        service.confirm(oid, pid)
        return {"ok": True}

    async def read_upload(file):
        content = await file.read(20 * 1024 * 1024 + 1)
        await file.close()
        if len(content) > 20 * 1024 * 1024:
            raise AppError("Upload must be 20 MB or smaller.", 413)
        return content

    @router.post("/projects/{pid}/sources", status_code=201)
    async def upload(pid: str, file: UploadFile = File(...), oid=Depends(owner)):
        from starlette.concurrency import run_in_threadpool

        data = await read_upload(file)
        sid = await run_in_threadpool(service.upload, oid, pid, file.filename or "source.pdf", data)
        return {"id": sid}

    @router.post("/projects/{pid}/sources/{sid}/process")
    def process(pid: str, sid: str, body: Run, oid=Depends(owner)):
        service.process(oid, pid, sid, body.force)
        return {"ok": True}

    @router.delete("/projects/{pid}/sources/{sid}")
    def remove(pid: str, sid: str, oid=Depends(owner)):
        service.remove_source(oid, pid, sid)
        return {"ok": True}

    @router.get("/projects/{pid}/sources/{sid}/file")
    def original(pid: str, sid: str, oid=Depends(owner)):
        return Response(
            service.original(oid, pid, sid),
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'inline; filename="source.pdf"',
                "Cache-Control": "private, no-store",
            },
        )

    @router.get("/projects/{pid}/sources/{sid}/pages/{number}")
    def page(pid: str, sid: str, number: int, oid=Depends(owner)):
        return service.page(oid, pid, sid, number)

    @router.post("/projects/{pid}/comparisons")
    def compare(pid: str, body: Selection, oid=Depends(owner)):
        service.compare(oid, pid, body.source_ids, body.force)
        return {"ok": True}

    @router.post("/projects/{pid}/drafts", status_code=201)
    def draft(pid: str, body: DraftInput, oid=Depends(owner)):
        return {"id": service.save_draft(oid, pid, body.title, body.text)}

    @router.put("/projects/{pid}/drafts/{did}")
    def update_draft(pid: str, did: str, body: DraftInput, oid=Depends(owner)):
        return {"id": service.save_draft(oid, pid, body.title, body.text, did)}

    @router.post("/projects/{pid}/draft-upload", status_code=201)
    async def draft_upload(pid: str, file: UploadFile = File(...), oid=Depends(owner)):
        from starlette.concurrency import run_in_threadpool

        data = await read_upload(file)
        did = await run_in_threadpool(service.upload_draft, oid, pid, file.filename or "draft.txt", data)
        return {"id": did}

    @router.post("/projects/{pid}/drafts/{did}/check")
    def check(pid: str, did: str, body: Run, oid=Depends(owner)):
        service.check_draft(oid, pid, did, body.force)
        return {"ok": True}

    @router.get("/hub")
    def notes(q: str = "", oid=Depends(owner)):
        return service.notes(q[:200])

    @router.post("/hub", status_code=201)
    def post_note(body: NoteInput, oid=Depends(owner)):
        service.post_note(oid, body.topic, body.note)
        return {"ok": True}

    return router
