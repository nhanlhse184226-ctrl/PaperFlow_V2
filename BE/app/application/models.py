from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def uid() -> str:
    return str(uuid4())


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Context(Model):
    output_language: Literal["en", "vi"] = "en"
    title: str = Field(min_length=3, max_length=300)
    description: str = Field(default="", max_length=5000)
    problem: str = Field(default="", max_length=3000)
    objectives: str = Field(default="", max_length=3000)
    questions: str = Field(default="", max_length=3000)
    team_size: int = Field(default=1, ge=1, le=100)
    skills: str = Field(default="", max_length=2000)
    timeline: str = Field(default="", max_length=1000)
    sources: str = Field(default="", max_length=2000)
    datasets: str = Field(default="", max_length=2000)
    constraints: str = Field(default="", max_length=3000)


class Dimension(Model):
    name: Literal["clarity", "scope", "feasibility", "researchability", "source readiness", "data readiness"]
    status: Literal["ready", "needs attention", "unknown"]
    explanation: str


class TopicAnalysis(Model):
    summary: str
    dimensions: list[Dimension] = Field(min_length=6, max_length=6)
    risks: list[str]
    missing_information: list[str]
    directions: list[str] = Field(max_length=5)
    keywords: list[str]
    next_steps: list[str]


class Page(Model):
    number: int = Field(ge=1)
    text: str


class GroundedFact(Model):
    field: Literal[
        "title",
        "authors",
        "year",
        "publication",
        "doi",
        "objective",
        "problem",
        "method",
        "sample",
        "scope",
        "findings",
        "limitations",
    ]
    value: str = Field(min_length=1, max_length=4000)
    page: int = Field(ge=1)
    quote: str = Field(min_length=8, max_length=6000)


class Evaluation(Model):
    facts: list[GroundedFact]
    relevance: str
    usefulness: str
    recency: str
    limitations: list[str]
    warnings: list[str]


class EvidenceCandidate(Model):
    page: int = Field(ge=1)
    quote: str = Field(min_length=8, max_length=6000)
    kind: Literal["problem", "objective", "method", "sample", "finding", "limitation", "gap"]
    content: str = Field(min_length=3, max_length=4000)


class EvidenceResult(Model):
    items: list[EvidenceCandidate] = Field(max_length=100)


class Evidence(EvidenceCandidate):
    id: str = Field(default_factory=uid)
    source_id: str


class Source(Model):
    id: str = Field(default_factory=uid)
    filename: str
    digest: str
    created_at: str = Field(default_factory=now)
    pages: list[Page] = Field(default_factory=list)
    status: Literal["extracted", "ready", "partial", "failed"] = "extracted"
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    evaluation: Evaluation | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    evidence_done: bool = False


class Support(str, Enum):
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    UNSUPPORTED = "UNSUPPORTED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class Match(Model):
    evidence_id: str
    relation: Literal["supporting", "partial", "contradictory", "context"]
    explanation: str


class ClaimCandidate(Model):
    text: str = Field(min_length=8)


class ClaimsResult(Model):
    claims: list[ClaimCandidate] = Field(max_length=40)


class Check(Model):
    status: Support
    relevance: str
    matches: list[Match]
    citation_issue: str
    limitation: str
    action: str
    explanation: str


class Claim(ClaimCandidate):
    id: str = Field(default_factory=uid)
    check: Check | None = None


class Draft(Model):
    id: str = Field(default_factory=uid)
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=20, max_length=60000)
    created_at: str = Field(default_factory=now)
    status: Literal["saved", "checked", "partial", "failed"] = "saved"
    error: str | None = None
    claims: list[Claim] = Field(default_factory=list)


class Comparison(Model):
    evidence_ids: list[str] = Field(min_length=2, max_length=10)
    relationship: Literal["agreement", "partial agreement", "contradiction", "insufficient evidence"]
    explanation: str


class Comparisons(Model):
    items: list[Comparison] = Field(max_length=30)


class Project(Model):
    id: str = Field(default_factory=uid)
    owner_id: str
    name: str = Field(min_length=3, max_length=200)
    created_at: str = Field(default_factory=now)
    updated_at: str = Field(default_factory=now)
    version: int = 0
    context: Context
    analysis: TopicAnalysis | None = None
    analysis_translations: dict[str, TopicAnalysis] = Field(default_factory=dict)
    confirmed: bool = False
    sources: list[Source] = Field(default_factory=list)
    drafts: list[Draft] = Field(default_factory=list)
    comparisons: list[Comparison] = Field(default_factory=list)
    comparison_key: str | None = None
    activity: list[str] = Field(default_factory=list)


class AppError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status
