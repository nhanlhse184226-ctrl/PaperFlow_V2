from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.application.models import AppError


class GoogleIdentityVerifier:
    """Verifies Google-issued ID tokens without retaining Google access tokens."""

    def __init__(self, client_id: str):
        self.client_id = client_id.strip()

    @property
    def configured(self) -> bool:
        return bool(self.client_id)

    def verify(self, credential: str) -> str:
        if not self.configured:
            raise AppError("Google sign-in is not configured.", 503)
        try:
            claims = id_token.verify_oauth2_token(
                credential, google_requests.Request(), self.client_id
            )
        except (ValueError, google_exceptions.GoogleAuthError):
            raise AppError("Google could not verify this sign-in. Please try again.", 401) from None

        email = claims.get("email")
        if not claims.get("email_verified") or not isinstance(email, str):
            raise AppError("Google did not provide a verified email address.", 401)
        return email.strip().lower()
