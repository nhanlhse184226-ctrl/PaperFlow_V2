"""Read-only integrity checks for the deployed SQLite database; run inside backend."""

import json
import sqlite3
from pathlib import Path

from app.infrastructure.repository import SqliteRepository

with sqlite3.connect("file:/data/paperflow.db?mode=ro", uri=True) as db:
    integrity = db.execute("PRAGMA integrity_check").fetchall()
    foreign_keys = db.execute("PRAGMA foreign_key_check").fetchall()
    migrations = db.execute("SELECT * FROM migrations").fetchall()
    counts = {
        table: db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        for table in [
            "projects",
            "sources",
            "pages",
            "evidence",
            "drafts",
            "claims",
            "matches",
            "operations",
        ]
    }
    repo = SqliteRepository(Path("/data/paperflow.db"))
    for project_id, owner_id, version in db.execute(
        "SELECT id,owner_id,version FROM projects"
    ):
        # The relational version column is authoritative on repository reads.
        assert version >= 0 and repo.get(owner_id, project_id).version == version
    assert integrity == [("ok",)] and not foreign_keys
    assert len(migrations) == 2
    assert counts["operations"] == 0
    print(
        json.dumps(
            {
                "integrity": integrity,
                "foreign_keys": foreign_keys,
                "migrations": migrations,
                "counts": counts,
                "versions": "coherent",
            },
            indent=2,
        )
    )
