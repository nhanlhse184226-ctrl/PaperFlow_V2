from io import BytesIO
from pathlib import Path
from uuid import UUID

from pypdf import PdfReader

from app.application.models import AppError, Page


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def path(self, source_id):
        return self.root / (str(UUID(source_id)) + ".pdf")

    def put(self, source_id, content):
        self.path(source_id).write_bytes(content)

    def read(self, source_id):
        try:
            return self.path(source_id).read_bytes()
        except FileNotFoundError:
            raise AppError("Original PDF is unavailable. Restore the storage backup.", 404) from None

    def delete(self, source_id):
        self.path(source_id).unlink(missing_ok=True)


class PypdfExtractor:
    def extract(self, content):
        if not content.startswith(b"%PDF-"):
            raise AppError("The uploaded file is not a PDF.")
        try:
            reader = PdfReader(BytesIO(content), strict=False)
            if reader.is_encrypted:
                raise AppError("Password-protected PDFs are not supported. Upload an unlocked copy.")
            if len(reader.pages) > 150:
                raise AppError("PDFs may contain at most 150 pages. Upload a smaller source.")
            pages = []
            for number, page in enumerate(reader.pages, 1):
                stream = page.get_contents()
                if stream and len(stream.get_data()) > 15_000_000:
                    raise AppError("A PDF page is too complex to process safely.")
                text = (page.extract_text() or "").strip()
                if len(text) > 80000:
                    raise AppError("A PDF page exceeds the text limit.")
                pages.append(Page(number=number, text=text))
            if sum(len(p.text) for p in pages) > 1_000_000:
                raise AppError("PDF text exceeds the processing limit. Split the document.")
            if not any(len(p.text) > 30 for p in pages):
                raise AppError("No readable text found. This may be a scanned PDF; run OCR before uploading.")
            return pages
        except AppError:
            raise
        except Exception:
            raise AppError("The PDF could not be read. Export a new PDF and retry.") from None
