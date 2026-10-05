"""Isolated local mobile integration server; never production or real AI."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "BE"))
from app.main import Settings, create_app  # noqa: E402
from tests.fakes import FakeAi  # noqa: E402

app = create_app(
    Settings(
        _env_file=None,
        data_dir=root / "artifacts" / "mobile" / "fixture-data",
        database_url="",
        environment="development",
        ai_provider="gemini",
        gemini_api_key="",
        secure_cookies=False,
        cookie_samesite="strict",
        allowed_hosts="127.0.0.1,localhost",
        allowed_origins="http://127.0.0.1:8011",
    ),
    ai=FakeAi(),
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MOBILE_TEST_PORT", "8011")))
