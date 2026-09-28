import json
import logging

import httpx
from pydantic import ValidationError

from app.application.models import (
    AppError,
    Check,
    ClaimsResult,
    Comparisons,
    Evaluation,
    EvidenceResult,
    TopicAnalysis,
)
from app.infrastructure.gemini import SYSTEM, provider_schema

logger = logging.getLogger("paperflow.ai")


class OllamaAiProvider:
    """Local Ollama adapter using its JSON-schema structured-output API."""

    def __init__(self, model: str, base_url: str = "http://127.0.0.1:11434", transport=None):
        self.model, self.base_url, self.transport = model, base_url.rstrip("/"), transport

    def _run(self, instruction, data, schema):
        payload = {
            "model": self.model,
            "stream": False,
            "format": provider_schema(schema),
            "options": {"temperature": 0.1},
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": instruction + "\nINPUT DATA:\n" + json.dumps(data, ensure_ascii=False),
                },
            ],
        }
        with httpx.Client(timeout=300, transport=self.transport) as client:
            for attempt in range(2):
                try:
                    response = client.post(self.base_url + "/api/chat", json=payload)
                except httpx.TimeoutException:
                    raise AppError(
                        "Local AI request timed out. Your saved work is safe; retry the operation.", 504
                    ) from None
                except httpx.RequestError:
                    raise AppError(
                        "Ollama is not reachable. Start Ollama locally and pull the configured OLLAMA_MODEL.",
                        503,
                    ) from None
                logger.info(
                    "Ollama task=%s model=%s attempt=%s status=%s",
                    schema.__name__,
                    self.model,
                    attempt + 1,
                    response.status_code,
                )
                if response.status_code == 404:
                    raise AppError(
                        "The configured Ollama model is unavailable. Run: ollama pull " + self.model, 503
                    )
                if not response.is_success:
                    raise AppError(
                        "Ollama could not complete the request. Saved results are preserved; retry later.",
                        503,
                    )
                try:
                    return schema.model_validate_json(response.json()["message"]["content"])
                except (KeyError, TypeError, ValueError, ValidationError):
                    if attempt == 0:
                        continue
                    raise AppError(
                        "Ollama returned an invalid structured result. No unverified result was accepted; retry.",
                        502,
                    ) from None

    def analyze_topic(self, context):
        return self._run(
            "Assess all six distinct readiness dimensions. The dimensions array MUST contain exactly one item each named clarity, scope, feasibility, researchability, source readiness, and data readiness. Suggest refinements/directions and keywords. Mark unprovided resources unknown; do not claim to have searched literature. "
            + (
                "Write ALL free-text values in Vietnamese. "
                if context.output_language == "vi"
                else "Write ALL free-text values in English. "
            )
            + "Keep schema enum values unchanged.",
            context.model_dump(),
            TopicAnalysis,
        )

    def translate_topic(self, analysis, language):
        return self._run(
            "Translate ALL free-text values of this saved analysis into "
            + ("Vietnamese" if language == "vi" else "English")
            + ". Preserve meaning, all numbers, uncertainty, array lengths and order. "
            "Keep dimension name and status enum values EXACTLY unchanged. Do not reassess or add facts.",
            analysis.model_dump(),
            TopicAnalysis,
        )

    def evaluate_source(self, context, pages):
        return self._run(
            "Evaluate this source relative to the topic. Facts must include verbatim quotes and page identity. A fact value must itself appear in its quote. For absent facts omit the entry. Recency cannot imply quality. Interpretations go only in relevance/usefulness/limitations/warnings.",
            {"topic": context.model_dump(), "pages": [p.model_dump() for p in pages]},
            Evaluation,
        )

    def extract_evidence(self, context, pages):
        return self._run(
            "Extract up to 100 meaningful evidence items: problems, objectives, methods, samples, findings, limitations, explicit gaps. Every item requires a verbatim quote (8-6000 characters) and supplied page. Content (3-4000 characters) must be a concise VERBATIM excerpt contained in that quote, preserving scope and conditions. Return empty items if none.",
            {"topic": context.model_dump(), "pages": [p.model_dump() for p in pages]},
            EvidenceResult,
        )

    def extract_claims(self, text):
        return self._run(
            "Extract up to 40 meaningful factual/research claims requiring evidence. Copy each claim text verbatim from the draft; do not rewrite. Skip headings and purely personal statements.",
            {"draft": text},
            ClaimsResult,
        )

    def check_claim(self, context, claim, evidence):
        return self._run(
            "Check the claim against only these retrieved evidence items. Preserve scope/conditions and use exact supplied evidence IDs. SUPPORTED requires direct evidence for the full claim. PARTIALLY_SUPPORTED means narrower or mixed support. CONTRADICTED requires an actual opposite finding. UNSUPPORTED applies to an unsupported named-source attribution. INSUFFICIENT_EVIDENCE applies to an unstudied outcome. Use context only for gaps/limits, never as support or contradiction.",
            {"topic": context.model_dump(), "claim": claim, "evidence": [e.model_dump() for e in evidence]},
            Check,
        )

    def compare(self, context, evidence):
        return self._run(
            "Compare findings and methods across DIFFERENT sources. Return only defensible agreements, partial agreements, contradictions, or insufficient evidence. Each comparison references at least two supplied evidence IDs from different sources. Do not confuse different scopes with contradictions.",
            {"topic": context.model_dump(), "evidence": [e.model_dump() for e in evidence]},
            Comparisons,
        )
