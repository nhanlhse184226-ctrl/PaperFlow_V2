import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Compass,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { api } from "../../api";
import { Badge, Empty, Notice, TextList, Modal } from "../../ui";
import type { Source, WorkspaceProps } from "../../types";
export default function Sources({
  p,
  run,
  busy,
  base,
  inspect,
}: WorkspaceProps) {
  const [active, setActive] = useState<Source | null>(null),
    [remove, setRemove] = useState<Source | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const detail = active ? p.sources.find((s) => s.id === active.id) : null;
  async function upload(files: FileList | null) {
    if (!files) return;
    await run("Uploading and extracting PDF pages", async () => {
      for (const f of Array.from(files)) {
        const data = new FormData();
        data.append("file", f);
        await api(base + "/sources", "POST", data);
      }
    });
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your source library</h2>
          <p>Understand what each paper brings to your research.</p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => file.current?.click()}
        >
          <Upload size={17} />
          Upload PDFs
        </button>
        <input
          ref={file}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          aria-label="Upload research PDFs"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {!p.confirmed && (
        <div className="info-banner">
          <Compass size={18} />
          You can upload now.{" "}
          <Link to={base + "/topic"}>Confirm your direction</Link> before source
          evaluation.
        </div>
      )}
      <div
        className="upload-area"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) void upload(e.dataTransfer.files);
        }}
      >
        <Upload size={23} />
        <div>
          <strong>Bring your reading into one place</strong>
          <p>
            Drop PDFs here or{" "}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              browse files
            </button>
            . Up to 20 MB and 150 pages per source.
          </p>
        </div>
        <Badge>PDF</Badge>
      </div>
      {p.sources.length ? (
        <div className="source-list">
          {p.sources.map((s) => (
            <article className="source-card" key={s.id}>
              <div className="source-icon">
                <FileText />
              </div>
              <div className="source-main">
                <div className="source-title">
                  <button className="text-button" onClick={() => setActive(s)}>
                    {s.filename}
                  </button>
                  <Badge
                    tone={
                      s.status === "ready"
                        ? "good"
                        : s.status === "failed"
                          ? "bad"
                          : "warm"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <p>
                  {s.page_count} pages · {s.evidence.length} evidence items ·{" "}
                  {s.evaluation ? "Evaluation saved" : "Awaiting evaluation"}
                </p>
                {s.error && <p className="inline-error">{s.error}</p>}
              </div>
              <div className="source-actions">
                <button
                  disabled={busy || !p.confirmed || !s.page_count}
                  onClick={() =>
                    void run("Evaluating " + s.filename, () =>
                      api(base + "/sources/" + s.id + "/process", "POST", {
                        force: s.evidence_done && !!s.evaluation,
                      }),
                    )
                  }
                >
                  {s.evidence_done && s.evaluation
                    ? "Reprocess"
                    : s.evaluation
                      ? "Continue processing"
                      : "Evaluate & extract"}
                </button>
                <button
                  className="icon-button"
                  aria-label={"Remove " + s.filename}
                  disabled={busy}
                  onClick={() => setRemove(s)}
                >
                  <X size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="A stronger argument starts with good sources">
          <p>
            Upload research papers to assess relevance, methods, findings, and
            limitations.
          </p>
        </Empty>
      )}
      {detail && (
        <Modal wide title="Source evaluation" close={() => setActive(null)}>
          <h3>{detail.filename}</h3>
          <div className="actions">
            <Badge>{detail.page_count} extracted pages</Badge>
            <a
              className="button"
              href={"/api" + base + "/sources/" + detail.id + "/file"}
              target="_blank"
              rel="noreferrer"
            >
              Open original PDF
              <ArrowRight size={15} />
            </a>
          </div>
          {detail.error && <Notice>{detail.error}</Notice>}
          <TextList title="Extraction notes" items={detail.warnings} />
          {detail.evaluation ? (
            <>
              <h3 className="subheading">Source-derived information</h3>
              <p className="muted">
                Quoted from the source. Fields absent below are unknown or
                unavailable.
              </p>
              <div className="fact-grid">
                {detail.evaluation.facts.map((f, i) => (
                  <div key={i}>
                    <h4>{f.field}</h4>
                    <p>{f.value}</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setActive(null);
                        inspect({
                          id: "fact",
                          source_id: detail.id,
                          page: f.page,
                          quote: f.quote,
                          kind: f.field,
                          content: f.value,
                        });
                      }}
                    >
                      Verify on page {f.page}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <h3 className="subheading">AI evaluation</h3>
              <div className="evaluation-block">
                <h4>Topic relevance</h4>
                <p>{detail.evaluation.relevance}</p>
                <h4>Evidence usefulness</h4>
                <p>{detail.evaluation.usefulness}</p>
                <h4>Recency</h4>
                <p>{detail.evaluation.recency}</p>
              </div>
              <TextList
                title="Limitations"
                items={detail.evaluation.limitations}
              />
              <TextList
                title="Evaluation warnings"
                items={detail.evaluation.warnings}
              />
            </>
          ) : (
            <Empty title="Not evaluated yet">
              <p>Confirm a research direction, then evaluate this source.</p>
            </Empty>
          )}
        </Modal>
      )}
      {remove && (
        <Modal title="Remove this source?" close={() => setRemove(null)}>
          <p>
            Removing <strong>{remove.filename}</strong> also removes its
            evidence and resets saved comparisons and draft checks.
          </p>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              void run("Removing source", () =>
                api(base + "/sources/" + remove.id, "DELETE"),
              );
              setRemove(null);
            }}
          >
            Remove source and evidence
          </button>
        </Modal>
      )}
    </>
  );
}
