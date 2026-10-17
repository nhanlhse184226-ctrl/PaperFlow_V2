import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "../../api";
import { Badge, Empty } from "../../ui";
import { useLanguage } from "../../i18n";
import type { Evidence, WorkspaceProps } from "../../types";
import AiFeedback from "../../components/AiFeedback";

type MatrixTranslation = {
  evidence: Record<string, string>;
  comparisons: string[];
};
const PAGE_SIZE = 25;

export default function Matrix({ p, run, busy, base, inspect }: WorkspaceProps) {
  const [comparisonSources, setComparisonSources] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [sourceId, setSourceId] = useState("all");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const language = useLanguage();
  const [translation, setTranslation] = useState<MatrixTranslation | null>(null);
  const evidence = p.sources.flatMap((source) => source.evidence);
  const filtered = evidence.filter((item) =>
    (sourceId === "all" || item.source_id === sourceId) &&
    (kind === "all" || item.kind === kind) &&
    (item.content +
      " " +
      item.quote +
      " " +
      (p.sources.find((source) => source.id === item.source_id)?.filename ?? ""))
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const translationIds = useMemo(() => visible.map((item) => item.id), [visible]);
  const translationIdsJson = JSON.stringify(translationIds);

  useEffect(() => setPage(1), [sourceId, kind, search]);
  useEffect(() => {
    let current = true;
    if (!translationIds.length && !p.comparisons.length) {
      setTranslation(null);
      return () => {
        current = false;
      };
    }
    void api<MatrixTranslation>(base + "/matrix/translation", "POST", {
      language,
      evidence_ids: translationIds,
    })
      .then((result) => current && setTranslation(result))
      .catch(() => current && setTranslation(null));
    return () => {
      current = false;
    };
  }, [base, language, p.comparisons.length, translationIdsJson]);

  function exportCsv() {
    const rows = [
      ["Source", "Type", "Interpretation", "Page", "Verified quote"],
      ...filtered.map((item) => [
        p.sources.find((source) => source.id === item.source_id)?.filename || "",
        item.kind,
        item.content,
        String(item.page),
        item.quote,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${(/^[=+@-]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "paperflow-evidence.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const kindCount = (name: string) =>
    evidence.filter((item) => item.kind === name).length;
  const typeLabel = (value: string) => {
    if (value === "problem") return "Problem · being addressed";
    if (value === "gap") return "Problem · still open";
    return value;
  };
  return (
    <>
      <div className="section-heading compact-heading matrix-heading">
        <div>
          <h2>Evidence matrix</h2>
          <p>
            {evidence.length} verified excerpts from your uploaded documents.
            Select one to open the exact page.
          </p>
        </div>
        <div className="actions">
          <button disabled={!filtered.length} onClick={exportCsv}>
            Export CSV <ArrowDown size={15} />
          </button>
          {p.sources.length > 1 && (
            <button
              className="primary"
              onClick={() => setComparisonOpen((value) => !value)}
            >
              <Sparkles size={16} />
              Compare documents
            </button>
          )}
        </div>
      </div>

      <section className="matrix-summary matrix-summary-primary" aria-label="Evidence summary">
        <div>
          <strong>{p.sources.length}</strong>
          <span>documents read</span>
        </div>
        <div>
          <strong>{evidence.length}</strong>
          <span>verified excerpts</span>
        </div>
        <div>
          <strong>{kindCount("problem")}</strong>
          <span>problems being addressed</span>
          <small>Issues the author is examining or working to resolve.</small>
        </div>
        <div>
          <strong>{kindCount("gap")}</strong>
          <span>problems still open</span>
          <small>Gaps the document says need further research or action.</small>
        </div>
      </section>

      <section className="matrix-controls" aria-label="Filter evidence">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search evidence"
            placeholder="Search evidence or document"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label>
          Document
          <select
            aria-label="Document"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="all">All documents</option>
            {p.sources.map((source) => (
              <option value={source.id} key={source.id}>
                {source.filename} ({source.evidence.length})
              </option>
            ))}
          </select>
        </label>
        <label>
          Issue status / evidence type
          <select
            aria-label="Evidence type"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {["all", "problem", "objective", "method", "sample", "finding", "limitation", "gap"].map(
              (item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All types" : typeLabel(item)}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      {comparisonOpen && p.sources.length > 1 && (
        <section className="compare-panel" aria-label="Compare documents">
          <div>
            <strong>Compare selected documents</strong>
            <p>
              Choose two or more documents, then compare the evidence they
              contain.
            </p>
          </div>
          <div className="compare-options">
            {p.sources.map((source) => (
              <label key={source.id}>
                <input
                  type="checkbox"
                  checked={comparisonSources.includes(source.id)}
                  onChange={(event) =>
                    setComparisonSources((ids) =>
                      event.target.checked
                        ? [...ids, source.id]
                        : ids.filter((id) => id !== source.id),
                    )
                  }
                />
                {source.filename}
              </label>
            ))}
          </div>
          <button
            className="primary"
            disabled={busy || !p.confirmed || comparisonSources.length < 2}
            onClick={() =>
              void run("Comparing evidence across sources", () =>
                api(base + "/comparisons", "POST", {
                  source_ids: comparisonSources,
                  force: true,
                }),
              )
            }
          >
            Compare selected documents
          </button>
        </section>
      )}

      {visible.length ? (
        <section className="matrix-results" aria-label="Evidence results">
          <div className="matrix-results-title">
            <strong>{filtered.length} evidence passages</strong>
            <span>
              Open a passage to see its verified quotation and original PDF
              page.
            </span>
          </div>
          <div className="evidence-list" role="table" aria-label="Evidence results">
            <div className="evidence-columns" role="row">
              <span>Document</span>
              <span>Issue status / evidence type</span>
              <span>What the document says</span>
              <span>Source page</span>
            </div>
            {visible.map((item) => (
              <EvidenceRow
                key={item.id}
                item={item}
                filename={
                  p.sources.find((source) => source.id === item.source_id)
                    ?.filename || "Unknown document"
                }
                text={translation?.evidence[item.id] || item.content}
                inspect={inspect}
              />
            ))}
          </div>
          {pageCount > 1 && (
            <nav className="matrix-pagination" aria-label="Evidence pages">
              <button
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button
                aria-label="Next page"
                disabled={page === pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </section>
      ) : (
        <Empty
          icon={<Layers3 size={28} />}
          title={evidence.length ? "No matching evidence" : "No evidence yet"}
        >
          <p>
            {evidence.length
              ? "Try another document, evidence type, or search term."
              : "Run Topic direction after uploading readable PDFs to create verified evidence."}
          </p>
        </Empty>
      )}

      {p.comparisons.length > 0 && (
        <section className="comparisons">
          <div className="section-heading compact-heading">
            <h2>Across documents</h2>
            <Badge>Saved comparison</Badge>
          </div>
          {p.comparisons.map((comparison, index) => (
            <article className="panel comparison" key={index}>
              <Badge
                tone={comparison.relationship === "contradiction" ? "warm" : "good"}
              >
                {comparison.relationship}
              </Badge>
              <p>{translation?.comparisons[index] || comparison.explanation}</p>
              <div className="actions">
                {comparison.evidence_ids.map((id) => {
                  const item = evidence.find((entry) => entry.id === id);
                  return item ? (
                    <button key={id} onClick={() => inspect(item)}>
                      {p.sources.find((source) => source.id === item.source_id)?.filename}
                      {" · p. "}
                      {item.page}
                    </button>
                  ) : null;
                })}
              </div>
            </article>
          ))}
        </section>
      )}
      <AiFeedback module="compare_sources" projectId={p.id} resultId={p.id} />
    </>
  );
}

function EvidenceRow({
  item,
  filename,
  text,
  inspect,
}: {
  item: Evidence;
  filename: string;
  text: string;
  inspect: (item: Evidence) => void;
}) {
  return (
    <article className="evidence-row" role="row">
      <div className="evidence-source" role="cell">
        <FileText size={16} />
        <span>{filename}</span>
      </div>
      <div role="cell">
        <Badge>{item.kind === "problem" ? "Problem · being addressed" : item.kind === "gap" ? "Problem · still open" : item.kind}</Badge>
      </div>
      <button className="evidence-content" onClick={() => inspect(item)}>
        <strong>{text}</strong>
        <span>“{item.quote}”</span>
      </button>
      <button className="provenance-link" onClick={() => inspect(item)}>
        Page {item.page}
        <ChevronRight size={14} />
      </button>
    </article>
  );
}
