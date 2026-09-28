import httpx
import pytest

from app.application.models import AppError
from app.infrastructure.ollama import OllamaAiProvider


def provider(handler):
    return OllamaAiProvider("qwen2.5:3b", transport=httpx.MockTransport(handler))


def test_structured_ollama_output():
    def handle(request):
        assert request.url.path == "/api/chat"
        assert b'"format"' in request.content
        return httpx.Response(200, json={"message": {"content": '{"claims":[]}'}})

    assert provider(handle).extract_claims("Academic draft").claims == []


def test_missing_local_model_is_actionable():
    with pytest.raises(AppError, match="ollama pull qwen2.5:3b"):
        provider(lambda request: httpx.Response(404)).extract_claims("Academic draft")


def test_invalid_local_output_is_rejected():
    with pytest.raises(AppError, match="invalid structured"):
        provider(
            lambda request: httpx.Response(200, json={"message": {"content": "not json"}})
        ).extract_claims("Academic draft")
