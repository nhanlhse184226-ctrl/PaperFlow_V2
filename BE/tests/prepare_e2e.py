from pathlib import Path
from tests.fakes import pdf_bytes

path = Path(__file__).resolve().parents[2] / "artifacts"
path.mkdir(exist_ok=True)
(path / "test-source.pdf").write_bytes(pdf_bytes())
