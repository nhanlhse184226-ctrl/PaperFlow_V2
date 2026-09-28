"""Isolated browser-test server. Never imported by production composition."""

import os
from pathlib import Path

from app.main import Settings, create_app
from tests.fakes import FakeAi

app = create_app(
    Settings(
        data_dir=Path(os.environ.get("E2E_DATA_DIR", "../artifacts/e2e-data")),
        allowed_origins="http://127.0.0.1:5173,http://localhost:5173",
    ),
    ai=FakeAi(),
)
