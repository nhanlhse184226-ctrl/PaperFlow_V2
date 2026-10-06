import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from app.application.models import AppError, Project, now, uid


class SqliteRepository:
    def __init__(self, path: Path, enforce_new_projects: bool = False):
        self.path = path
        self.enforce_new_projects = enforce_new_projects
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS migrations (version TEXT PRIMARY KEY)")
            for migration in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
                if not db.execute("SELECT 1 FROM migrations WHERE version=?", (migration.name,)).fetchone():
                    db.executescript("BEGIN IMMEDIATE;\n" + migration.read_text())
                    db.execute("INSERT INTO migrations VALUES (?)", (migration.name,))
                    db.commit()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, project):
        with self.connect() as db:
            db.execute(
                "INSERT INTO projects (id,owner_id,version,data,billing_enforced) VALUES (?,?,?,?,?)",
                (
                    project.id,
                    project.owner_id,
                    0,
                    project.model_dump_json(exclude={"sources", "drafts", "comparisons"}),
                    int(self.enforce_new_projects),
                ),
            )

    def _load(self, db, row):
        data = json.loads(row["data"])
        data["version"] = row["version"]
        data["sources"] = []
        for source in db.execute("SELECT * FROM sources WHERE project_id=? ORDER BY rowid", (row["id"],)):
            s = json.loads(source["data"])
            s["pages"] = [
                dict(number=p["number"], text=p["text"])
                for p in db.execute("SELECT * FROM pages WHERE source_id=? ORDER BY number", (s["id"],))
            ]
            s["evidence"] = [
                json.loads(e["data"])
                for e in db.execute("SELECT data FROM evidence WHERE source_id=? ORDER BY rowid", (s["id"],))
            ]
            data["sources"].append(s)
        data["drafts"] = []
        for draft in db.execute("SELECT * FROM drafts WHERE project_id=? ORDER BY rowid", (row["id"],)):
            d = json.loads(draft["data"])
            d["claims"] = []
            for claim in db.execute("SELECT * FROM claims WHERE draft_id=? ORDER BY rowid", (d["id"],)):
                c = json.loads(claim["data"])
                if c["check"] is not None:
                    c["check"]["matches"] = [
                        json.loads(m["data"])
                        for m in db.execute("SELECT data FROM matches WHERE claim_id=?", (c["id"],))
                    ]
                d["claims"].append(c)
            data["drafts"].append(d)
        data["comparisons"] = [
            json.loads(c["data"])
            for c in db.execute(
                "SELECT data FROM comparisons WHERE project_id=? ORDER BY ordinal", (row["id"],)
            )
        ]
        return Project.model_validate(data)

    def get(self, owner, project_id):
        with self.connect() as db:
            db.execute("BEGIN")
            row = db.execute(
                "SELECT * FROM projects WHERE id=? AND owner_id=?", (project_id, owner)
            ).fetchone()
            if not row:
                raise AppError("Project not found.", 404)
            return self._load(db, row)

    def list(self, owner):
        with self.connect() as db:
            db.execute("BEGIN")
            return [
                self._load(db, r)
                for r in db.execute(
                    "SELECT * FROM projects WHERE owner_id=? ORDER BY rowid DESC", (owner,)
                ).fetchall()
            ]

    def save(self, project):
        project.updated_at = now()
        with self.connect() as db:
            changed = db.execute(
                "UPDATE projects SET version=version+1,data=? WHERE id=? AND owner_id=? AND version=?",
                (
                    project.model_dump_json(exclude={"sources", "drafts", "comparisons"}),
                    project.id,
                    project.owner_id,
                    project.version,
                ),
            ).rowcount
            if not changed:
                raise AppError("Project changed in another request. Refresh and retry.", 409)
            db.execute("DELETE FROM drafts WHERE project_id=?", (project.id,))
            db.execute("DELETE FROM sources WHERE project_id=?", (project.id,))
            db.execute("DELETE FROM comparisons WHERE project_id=?", (project.id,))
            for s in project.sources:
                db.execute(
                    "INSERT INTO sources VALUES (?,?,?,?)",
                    (s.id, project.id, s.digest, s.model_dump_json(exclude={"pages", "evidence"})),
                )
                db.executemany(
                    "INSERT INTO pages VALUES (?,?,?)", [(s.id, p.number, p.text) for p in s.pages]
                )
                db.executemany(
                    "INSERT INTO evidence VALUES (?,?,?,?)",
                    [(e.id, s.id, e.page, e.model_dump_json()) for e in s.evidence],
                )
            for d in project.drafts:
                db.execute(
                    "INSERT INTO drafts VALUES (?,?,?)",
                    (d.id, project.id, d.model_dump_json(exclude={"claims"})),
                )
                for c in d.claims:
                    cd = c.model_dump(mode="json")
                    if c.check:
                        cd["check"]["matches"] = []
                    db.execute("INSERT INTO claims VALUES (?,?,?)", (c.id, d.id, json.dumps(cd)))
                    if c.check:
                        db.executemany(
                            "INSERT INTO matches VALUES (?,?,?)",
                            [(c.id, m.evidence_id, m.model_dump_json()) for m in c.check.matches],
                        )
            db.executemany(
                "INSERT INTO comparisons VALUES (?,?,?)",
                [(project.id, i, c.model_dump_json()) for i, c in enumerate(project.comparisons)],
            )
        project.version += 1

    def delete(self, owner, project_id):
        with self.connect() as db:
            db.execute("DELETE FROM projects WHERE id=? AND owner_id=?", (project_id, owner))

    def acquire(self, owner, project_id, label):
        self.get(owner, project_id)
        token = uid()
        with self.connect() as db:
            db.execute("DELETE FROM operations WHERE project_id=? AND expires<?", (project_id, time.time()))
            try:
                db.execute(
                    "INSERT INTO operations VALUES (?,?,?,?)", (project_id, token, label, time.time() + 1800)
                )
            except sqlite3.IntegrityError:
                raise AppError(
                    "This project is already processing. Wait for it to finish, then refresh.", 409
                ) from None
        return token

    def release(self, project_id, token):
        with self.connect() as db:
            db.execute("DELETE FROM operations WHERE project_id=? AND token=?", (project_id, token))

    def operation(self, project_id):
        with self.connect() as db:
            r = db.execute(
                "SELECT label,expires FROM operations WHERE project_id=? AND expires>?",
                (project_id, time.time()),
            ).fetchone()
            return dict(r) if r else None

    def register(self, email, password_hash, role="USER"):
        user_id = uid()
        with self.connect() as db:
            try:
                db.execute("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,?)", (user_id, email, password_hash, role))
            except sqlite3.IntegrityError:
                raise AppError("An account with this email already exists.", 409) from None
        return user_id

    def user(self, email):
        with self.connect() as db:
            r = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            return dict(r) if r else None

    def set_role(self, email, role):
        with self.connect() as db:
            db.execute("UPDATE users SET role=? WHERE email=?", (role, email))

    def session(self, token_hash, user_id, expires):
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            db.execute("INSERT INTO sessions VALUES (?,?,?)", (token_hash, user_id, expires))

    def authenticate(self, token_hash):
        with self.connect() as db:
            r = db.execute(
                "SELECT users.id,users.email,users.role FROM users JOIN sessions ON users.id=sessions.user_id WHERE token_hash=? AND expires>?",
                (token_hash, time.time()),
            ).fetchone()
            return dict(r) if r else None

    def logout(self, token_hash):
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))

    def notes(self, query):
        with self.connect() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT id,topic,note,created_at FROM notes WHERE topic LIKE ? ORDER BY created_at DESC LIMIT 100",
                    ("%" + query + "%",),
                )
            ]

    def post_note(self, owner, topic, note):
        with self.connect() as db:
            db.execute("INSERT INTO notes VALUES (?,?,?,?,?)", (uid(), owner, topic, note, now()))

    def create_billing_order(self, order):
        with self.connect() as db:
            db.execute("""INSERT INTO billing_orders
                (id,order_code,user_id,project_id,project_name,plan_id,plan_name,amount,status,payment_link_id,checkout_url,created_at,paid_at,provider_reference)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", tuple(order[key] for key in (
                "id","order_code","user_id","project_id","project_name","plan_id","plan_name","amount","status","payment_link_id","checkout_url","created_at","paid_at","provider_reference")))

    def project_billing_state(self, user_id, project_id):
        with self.connect() as db:
            row = db.execute("SELECT billing_enforced FROM projects WHERE id=? AND owner_id=?", (project_id, user_id)).fetchone()
            if not row:
                raise AppError("Project not found.", 404)
            plan = db.execute("""SELECT plan_id FROM billing_orders
                WHERE project_id=? AND user_id=? AND status='PAID'
                ORDER BY CASE plan_id WHEN 'pro' THEN 3 WHEN 'research' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END DESC,
                paid_at DESC LIMIT 1""", (project_id, user_id)).fetchone()
            return {"billing_enforced": bool(row["billing_enforced"]), "plan_id": plan["plan_id"] if plan else "free"}

    def mark_billing_paid(self, order_code, paid_at, reference):
        with self.connect() as db:
            return db.execute("""UPDATE billing_orders SET status='PAID',paid_at=?,provider_reference=?
                WHERE order_code=? AND status='PENDING' AND payment_link_id IS NOT NULL""",
                (paid_at, reference, order_code)).rowcount

    def mark_billing_cancelled(self, order_code, status):
        with self.connect() as db:
            return db.execute("UPDATE billing_orders SET status=? WHERE order_code=? AND status='PENDING'",
                              (status, order_code)).rowcount

    def billing_order(self, order_code):
        with self.connect() as db:
            row = db.execute("SELECT * FROM billing_orders WHERE order_code=?", (order_code,)).fetchone()
            return dict(row) if row else None

    def update_billing_order(self, order_code, **fields):
        if not fields:
            return
        with self.connect() as db:
            columns = ", ".join(f"{key}=?" for key in fields)
            db.execute(f"UPDATE billing_orders SET {columns} WHERE order_code=?", (*fields.values(), order_code))

    def billing_orders(self, user_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT * FROM billing_orders WHERE user_id=? ORDER BY created_at DESC", (user_id,))]

    def billing_overview(self):
        with self.connect() as db:
            total = db.execute("SELECT COUNT(*) AS orders, COALESCE(SUM(amount),0) AS revenue, COUNT(DISTINCT user_id) AS customers FROM billing_orders WHERE status='PAID'").fetchone()
            pending = db.execute("SELECT COUNT(*) AS count FROM billing_orders WHERE status='PENDING'").fetchone()
            trend = [dict(row) for row in db.execute("SELECT substr(COALESCE(paid_at,created_at),1,10) AS day, COALESCE(SUM(CASE WHEN status='PAID' THEN amount ELSE 0 END),0) AS revenue, COUNT(CASE WHEN status='PAID' THEN 1 END) AS orders FROM billing_orders GROUP BY day ORDER BY day DESC LIMIT 7").fetchall()][::-1]
            recent = [dict(row) for row in db.execute("SELECT billing_orders.*, users.email FROM billing_orders JOIN users ON users.id=billing_orders.user_id ORDER BY created_at DESC LIMIT 10").fetchall()]
            return {"revenue": total["revenue"], "paid_orders": total["orders"], "customers": total["customers"], "pending_orders": pending["count"], "trend": trend, "recent_orders": recent}

    @staticmethod
    def _feedback(row):
        item = dict(row)
        item["helpful"] = None if item["helpful"] is None else bool(item["helpful"])
        item["metadata"] = json.loads(item["metadata"] or "{}")
        return item

    def create_feedback(self, item):
        stored = {**item, "metadata": json.dumps(item["metadata"], separators=(",", ":"))}
        with self.connect() as db:
            db.execute("""INSERT INTO feedback_items
                (id,user_id,kind,module,result_id,project_id,helpful,reason,product_type,comment,metadata,status,created_at,updated_at)
                VALUES (:id,:user_id,:kind,:module,:result_id,:project_id,:helpful,:reason,:product_type,:comment,:metadata,:status,:created_at,:updated_at)""", stored)
        return {**item, "metadata": item["metadata"]}

    def upsert_ai_feedback(self, item):
        with self.connect() as db:
            existing = db.execute("SELECT id FROM feedback_items WHERE user_id=? AND module=? AND result_id=? AND kind='AI'", (item["user_id"], item["module"], item["result_id"])).fetchone()
            if existing:
                item["id"] = existing["id"]
                db.execute("""UPDATE feedback_items SET helpful=:helpful,reason=:reason,comment=:comment,status='NEW',updated_at=:updated_at
                    WHERE id=:id""", item)
        if not existing:
            return self.create_feedback(item)
        return {**item, "metadata": {}}

    def feedback_summary(self):
        with self.connect() as db:
            rows = db.execute("SELECT module, COUNT(*) AS total, SUM(CASE WHEN helpful=1 THEN 1 ELSE 0 END) AS positive FROM feedback_items WHERE kind='AI' GROUP BY module").fetchall()
            total = sum(row["total"] for row in rows)
            positive = sum(row["positive"] or 0 for row in rows)
            return {"total": total, "positive": positive, "helpful_rate": round(positive * 100 / total) if total else None, "by_module": [{"module": row["module"], "total": row["total"], "positive": row["positive"] or 0, "helpful_rate": round((row["positive"] or 0) * 100 / row["total"])} for row in rows]}

    def feedback_list(self, category, status=None):
        clauses, values = [], []
        if category == "negative":
            clauses.append("f.kind='AI' AND f.helpful=0")
        if category == "bug":
            clauses.append("f.kind='PRODUCT' AND f.product_type='BUG'")
        if category == "suggestion":
            clauses.append("f.kind='PRODUCT' AND f.product_type='SUGGESTION'")
        if status:
            clauses.append("f.status=?")
            values.append(status)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with self.connect() as db:
            rows = db.execute("SELECT f.*,u.email AS user_email FROM feedback_items f JOIN users u ON u.id=f.user_id" + where + " ORDER BY f.created_at DESC LIMIT 200", values).fetchall()
            return [self._feedback(row) for row in rows]

    def feedback_item(self, feedback_id):
        with self.connect() as db:
            row = db.execute("SELECT f.*,u.email AS user_email FROM feedback_items f JOIN users u ON u.id=f.user_id WHERE f.id=?", (feedback_id,)).fetchone()
            return self._feedback(row) if row else None

    def update_feedback_status(self, feedback_id, status, updated_at):
        with self.connect() as db:
            return db.execute("UPDATE feedback_items SET status=?,updated_at=? WHERE id=?", (status, updated_at, feedback_id)).rowcount
