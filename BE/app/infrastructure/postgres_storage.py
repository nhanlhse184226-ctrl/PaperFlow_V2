"""Durable PDF storage backed by the hosted PostgreSQL database."""

import psycopg

from app.application.models import AppError


class PostgresStorage:
    """Private source-file storage for hosted deployments.

    Keeping files in the same Supabase PostgreSQL project avoids exposing a
    Storage API key while preserving originals across Render restarts.
    """

    def __init__(self, database_url: str):
        self.database_url = database_url
        with self._connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS source_files "
                "(source_id TEXT PRIMARY KEY, content BYTEA NOT NULL)"
            )

    def _connect(self):
        return psycopg.connect(self.database_url)

    def put(self, source_id: str, content: bytes):
        with self._connect() as db:
            db.execute(
                "INSERT INTO source_files (source_id, content) VALUES (%s, %s) "
                "ON CONFLICT (source_id) DO UPDATE SET content=EXCLUDED.content",
                (source_id, content),
            )

    def read(self, source_id: str):
        with self._connect() as db:
            row = db.execute(
                "SELECT content FROM source_files WHERE source_id=%s", (source_id,)
            ).fetchone()
        if not row:
            raise AppError("Original PDF is unavailable. Restore the storage backup.", 404)
        return bytes(row[0])

    def delete(self, source_id: str):
        with self._connect() as db:
            db.execute("DELETE FROM source_files WHERE source_id=%s", (source_id,))
