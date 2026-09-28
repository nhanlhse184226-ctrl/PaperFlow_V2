from app.application.models import (
    Check,
    ClaimCandidate,
    ClaimsResult,
    Comparison,
    Comparisons,
    Dimension,
    Evaluation,
    EvidenceCandidate,
    EvidenceResult,
    GroundedFact,
    Match,
    TopicAnalysis,
)

QUOTE = "Students using guided feedback improved their programming performance in the study."
CLAIM = "Guided feedback improves student programming performance."


def pdf_bytes(text=QUOTE):
    content = f"BT /F1 12 Tf 50 750 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    result, offsets = b"%PDF-1.4\n", [0]
    for n, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f"{n} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(result)
    result += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    result += b"".join(f"{o:010} 00000 n \n".encode() for o in offsets[1:])
    result += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return result


class FakeAi:
    def __init__(self):
        self.calls = []
        self.mode = "supported"

    def analyze_topic(self, context):
        self.calls.append("topic")
        return TopicAnalysis(
            summary="A focused question needs an available dataset.",
            dimensions=[
                Dimension(name=n, status="unknown", explanation="More context is needed.")
                for n in [
                    "clarity",
                    "scope",
                    "feasibility",
                    "researchability",
                    "source readiness",
                    "data readiness",
                ]
            ],
            risks=["Access to student data"],
            missing_information=["Dataset access"],
            directions=["Guided feedback in introductory programming"],
            keywords=["guided feedback"],
            next_steps=["Confirm data access"],
        )

    def evaluate_source(self, context, pages):
        self.calls.append("evaluate")
        return Evaluation(
            facts=[
                GroundedFact(field="findings", value=QUOTE, page=1, quote=QUOTE),
                GroundedFact(
                    field="authors", value="Invented author", page=1, quote="Invented author wrote this paper"
                ),
            ],
            relevance="Relevant to feedback and programming.",
            usefulness="One conditional finding.",
            recency="Publication date unknown.",
            limitations=["Study context is limited."],
            warnings=[],
        )

    def extract_evidence(self, context, pages):
        self.calls.append("extract")
        return EvidenceResult(
            items=[
                EvidenceCandidate(
                    page=1,
                    quote=QUOTE,
                    kind="finding",
                    content="Guided feedback improved performance in the study.",
                ),
                EvidenceCandidate(
                    page=99,
                    quote="A fabricated unsupported quotation.",
                    kind="finding",
                    content="Rejected finding",
                ),
            ]
        )

    def extract_claims(self, text):
        self.calls.append("claims")
        return ClaimsResult(claims=[ClaimCandidate(text=text)])

    def check_claim(self, context, claim, evidence):
        self.calls.append("check")
        matches = []
        if self.mode in ("supported", "mixed", "invalid"):
            matches.append(
                Match(
                    evidence_id=evidence[0].id if self.mode != "invalid" else "invented-id",
                    relation="supporting",
                    explanation="The study supports the scoped claim.",
                )
            )
        if self.mode in ("contradicted", "mixed"):
            matches.append(
                Match(
                    evidence_id=evidence[-1].id, relation="contradictory", explanation="The evidence differs."
                )
            )
        if self.mode == "partial":
            matches.append(
                Match(
                    evidence_id=evidence[0].id,
                    relation="partial",
                    explanation="Only specific conditions are supported.",
                )
            )
        return Check(
            status="UNSUPPORTED" if self.mode == "unsupported" else "SUPPORTED",
            relevance="Related to the topic",
            matches=matches,
            citation_issue="Add a citation for this finding.",
            limitation="Limited study scope.",
            action="Qualify the claim and cite the source.",
            explanation="Assessment based on project evidence.",
        )

    def compare(self, context, evidence):
        self.calls.append("compare")
        return Comparisons(
            items=[
                Comparison(
                    evidence_ids=[evidence[0].id, evidence[-1].id],
                    relationship="agreement",
                    explanation="Both sources describe a similar result.",
                )
            ]
        )
