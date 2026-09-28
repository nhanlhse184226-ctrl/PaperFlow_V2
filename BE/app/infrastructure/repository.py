import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from app.application.models import AppError, Project, now, uid


class SqliteRepository:
    def __init__(self, path: Path):
        self.path = path
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
                "INSERT INTO projects VALUES (?,?,?,?)",
                (
                    project.id,
                    project.owner_id,
                    0,
                    project.model_dump_json(exclude={"sources", "drafts", "comparisons"}),
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

    def register(self, email, password_hash):
        user_id = uid()
        with self.connect() as db:
            try:
                db.execute("INSERT INTO users VALUES (?,?,?)", (user_id, email, password_hash))
            except sqlite3.IntegrityError:
                raise AppError("An account with this email already exists.", 409) from None
        return user_id

    def user(self, email):
        with self.connect() as db:
            r = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            return dict(r) if r else None

    def session(self, token_hash, user_id, expires):
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            db.execute("INSERT INTO sessions VALUES (?,?,?)", (token_hash, user_id, expires))

    def authenticate(self, token_hash):
        with self.connect() as db:
            r = db.execute(
                "SELECT users.id,users.email FROM users JOIN sessions ON users.id=sessions.user_id WHERE token_hash=? AND expires>?",
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
