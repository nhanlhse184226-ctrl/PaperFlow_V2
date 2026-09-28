"""Generate original synthetic research inputs; these are not application outputs."""

import json
import textwrap
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

ROOT = Path(__file__).resolve().parents[2] / "artifacts" / "live"
PAPERS = {
    "A-guided-feedback.pdf": [
        "Guided AI feedback in introductory programming\nSynthetic verification study A. Not a published research paper.\nObjective: assess supervised AI feedback in one introductory programming course.\nMethod: randomized classroom experiment with 80 first-year students over eight weeks.\nThe intervention paired AI coding suggestions with mandatory instructor review.\nThe comparison group received the same exercises without AI suggestions.",
        "Results and limitations - study A\nStudents receiving supervised AI feedback improved their immediate programming test scores by 12 points relative to the comparison group.\nThe improvement was observed only in this eight-week course with instructor review.\nThe study did not measure graduation time, teaching costs, or long-term employment.\nNo conclusion about teaching cost savings can be drawn from these measurements.\nThe single-course sample limits generalization to other courses and unsupervised settings.",
    ],
    "B-conditional-benefits.pdf": [
        "Conditional benefits of AI coding suggestions\nSynthetic verification study B. Not a published research paper.\nObjective: examine whether prior programming experience changes the effect of AI suggestions.\nMethod: controlled six-week study of 60 students with separate novice and experienced subgroups.\nStudents worked with AI suggestions and instructor guidance.",
        "Findings and scope - study B\nExperienced students completed practice exercises faster when using guided AI coding suggestions.\nNovice students showed no measurable improvement in programming test scores.\nBenefits depended on prior experience and instructor guidance; these findings do not establish benefits for every student.\nThe study did not measure long-term retention beyond six weeks or employment outcomes.",
    ],
    "C-retention-risk.pdf": [
        "Unsupervised AI assistance and delayed retention\nSynthetic verification study C. Not a published research paper.\nObjective: evaluate delayed retention after unsupervised use of AI coding assistants.\nMethod: randomized study of 50 novice students completing four weeks of programming practice.\nOne group could copy AI solutions without explanation; the comparison group solved exercises independently.",
        "Results and limitations - study C\nStudents using unsupervised AI solutions scored 8 points lower on the delayed retention test than students solving exercises independently.\nUnsupervised AI solution use reduced delayed retention in this cohort.\nThis result concerns unsupervised solution copying, not guided feedback with instructor review.\nGraduation, teaching costs, and long-term employment were not studied.\nThe effect of guided AI feedback on employment after graduation remains unknown.",
    ],
}
DRAFT = """Students receiving supervised AI feedback in study A improved their immediate programming test scores by 12 points relative to the comparison group.

AI coding assistants improve programming performance for every student regardless of prior experience or supervision.

Unsupervised AI solution use improved delayed retention in the novice cohort studied in study C.

Study A concluded that AI coding assistants reduced teaching costs by 40 percent.

Guided AI feedback improves long-term employment outcomes after graduation.

This review considers the boundaries of the available classroom evidence."""


def prepare():
    ROOT.mkdir(parents=True, exist_ok=True)
    for filename, pages in PAPERS.items():
        writer = PdfWriter()
        for content in pages:
            page = writer.add_blank_page(width=612, height=792)
            font = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                }
            )
            page[NameObject("/Resources")] = DictionaryObject(
                {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
            )
            lines = [line for paragraph in content.splitlines() for line in textwrap.wrap(paragraph, 85)]
            commands = ["BT /F1 10 Tf 14 TL 45 745 Td"]
            for line in lines:
                escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                commands.append(f"({escaped}) Tj T*")
            commands.append("ET")
            stream = DecodedStreamObject()
            stream.set_data("\n".join(commands).encode("ascii"))
            page[NameObject("/Contents")] = writer._add_object(stream)
        writer.write(ROOT / filename)
    (ROOT / "expected-pages.json").write_text(json.dumps(PAPERS, indent=2), encoding="utf-8")
    (ROOT / "draft.txt").write_text(DRAFT, encoding="utf-8")
    print("Prepared three original two-page synthetic verification PDFs and a controlled draft.")


if __name__ == "__main__":
    prepare()
