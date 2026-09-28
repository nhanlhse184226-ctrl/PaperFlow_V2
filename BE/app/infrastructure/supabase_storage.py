from urllib.parse import quote

import httpx

from app.application.models import AppError


class SupabaseStorage:
    """Private Supabase Storage bucket for original PDFs.

    Files are accessed only through the authenticated PaperFlow API; the
    service-role key remains server-side and is never sent to the browser.
    """

    def __init__(self, url: str, service_role_key: str, bucket: str):
        self.service_url = url.rstrip("/") + "/storage/v1"
        self.bucket = bucket
        self.base_url = self.service_url + "/object/" + quote(bucket, safe="")
        # Supabase's current sb_secret keys are opaque tokens and must only be
        # sent through apikey. Legacy service_role keys are JWTs and still need
        # the Authorization header for Storage's service-role access.
        self.headers = {"apikey": service_role_key}
        if service_role_key.startswith("eyJ"):
            self.headers["Authorization"] = f"Bearer {service_role_key}"

    @staticmethod
    def _name(source_id: str):
        return quote(source_id + ".pdf", safe="")

    @staticmethod
    def _error_code(response: httpx.Response):
        try:
            return str(response.json().get("code", "unknown"))
        except (ValueError, AttributeError):
            return "unknown"

    def ensure_bucket(self):
        existing = httpx.get(
            self.service_url + "/bucket/" + quote(self.bucket, safe=""),
            headers=self.headers,
            timeout=20,
        )
        if existing.status_code == 200:
            return
        if existing.status_code != 404:
            raise RuntimeError(
                "Supabase Storage bucket availability could not be checked "
                f"({existing.status_code}: {self._error_code(existing)})."
            )
        response = httpx.post(
            self.service_url + "/bucket",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"id": self.bucket, "name": self.bucket, "public": False},
            timeout=20,
        )
        # 409 means the private bucket already exists.
        if response.status_code not in (200, 201, 409):
            raise RuntimeError(
                "Supabase Storage bucket could not be initialized "
                f"({response.status_code}: {self._error_code(response)})."
            )

    def put(self, source_id: str, content: bytes):
        response = httpx.put(
            self.base_url + "/" + self._name(source_id),
            headers={**self.headers, "Content-Type": "application/pdf", "x-upsert": "true"},
            content=content,
            timeout=45,
        )
        if response.is_error:
            raise AppError("The PDF could not be stored. Please retry.", 503)

    def read(self, source_id: str):
        response = httpx.get(self.base_url + "/" + self._name(source_id), headers=self.headers, timeout=45)
        if response.status_code == 404:
            raise AppError("Original PDF is unavailable. Restore the storage backup.", 404)
        if response.is_error:
            raise AppError("The original PDF is temporarily unavailable. Please retry.", 503)
        return response.content

    def delete(self, source_id: str):
        response = httpx.delete(self.base_url, headers=self.headers, json={"prefixes": [source_id + ".pdf"]}, timeout=45)
        if response.is_error:
            raise AppError("The PDF could not be deleted. Please retry.", 503)
