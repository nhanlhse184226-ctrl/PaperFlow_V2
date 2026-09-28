import httpx
import pytest

from app.application.models import AppError, ClaimsResult
from app.infrastructure.gemini import GeminiAiProvider


def provider(handler):
    return GeminiAiProvider("test-key", "test-model", httpx.MockTransport(handler))


def test_structured_output():
    def handle(request):
        assert request.headers["x-goog-api-key"] == "test-key"
        assert b"responseJsonSchema" in request.content
        return httpx.Response(
            200,
            json={
                "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": '{"claims":[]}'}]}}]
            },
        )

    assert provider(handle).extract_claims("Academic draft").claims == []


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"candidates": []},
        {"candidates": [{"finishReason": "SAFETY"}]},
        {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "not JSON"}]}}]},
        {
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": '{"claims":[{"text":"x"}]}'}]}}
            ]
        },
    ],
)
def test_malformed_and_refused(data):
    with pytest.raises(AppError, match="invalid"):
        provider(lambda r: httpx.Response(200, json=data)).extract_claims("Academic draft")


@pytest.mark.parametrize("status", [400, 401, 403, 404, 429, 500, 503])
def test_provider_failures(status, monkeypatch):
    monkeypatch.setattr("app.infrastructure.gemini.time.sleep", lambda x: None)
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(status, json={"error": "Secret provider detail must not leak"})

    with pytest.raises(AppError) as exc:
        provider(handle).extract_claims("Academic draft")
    assert "Secret" not in exc.value.message
    assert len(calls) == (2 if status in [429, 500, 503] else 1)


def test_timeout():
    def handle(request):
        raise httpx.ReadTimeout("timeout", request=request)

    with pytest.raises(AppError, match="timed out"):
        provider(handle).extract_claims("Academic draft")


def test_missing_key():
    with pytest.raises(AppError, match="not configured"):
        GeminiAiProvider("", "test")._run("test", {}, ClaimsResult)


def test_provider_schema_preserves_contract_without_large_grammar_bounds():
    from app.application.models import EvidenceResult
    from app.infrastructure.gemini import provider_schema

    schema = provider_schema(EvidenceResult)
    assert "$defs" not in schema
    item = schema["properties"]["items"]["items"]
    assert set(item["required"]) == {"page", "quote", "kind", "content"}
    assert "finding" in item["properties"]["kind"]["enum"]
    assert "maxLength" not in item["properties"]["quote"]
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        EvidenceResult.model_validate(
            {"items": [{"page": 0, "quote": "short", "kind": "finding", "content": "x"}]}
        )


@pytest.mark.parametrize(
    "data", [{"candidates": [None]}, {"candidates": [{"finishReason": "STOP", "content": None}]}, [], None]
)
def test_invalid_response_shapes(data):
    with pytest.raises(AppError, match="invalid"):
        provider(lambda r: httpx.Response(200, json=data)).extract_claims("Academic draft")
