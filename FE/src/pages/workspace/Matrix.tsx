import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  FileText,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "../../api";
import { Badge, Empty } from "../../ui";
import type { WorkspaceProps } from "../../types";
export default function Matrix({
  p,
  run,
  busy,
  base,
  inspect,
}: WorkspaceProps) {
  const [selected, setSelected] = useState<string[]>([]),
    [kind, setKind] = useState("all"),
    [search, setSearch] = useState("");
  const evidence = p.sources.flatMap((s) => s.evidence),
    visible = evidence.filter(
      (e) =>
        (!selected.length || selected.includes(e.source_id)) &&
        (kind === "all" || e.kind === kind) &&
        (e.content + " " + e.quote)
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  function exportCsv() {
    const rows = [
      ["Source", "Type", "Interpretation", "Page", "Verified quote"],
      ...visible.map((e) => [
        p.sources.find((s) => s.id === e.source_id)?.filename || "",
        e.kind,
        e.content,
        String(e.page),
        e.quote,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (/^[=+@-]/.test(v) ? "'" : "") +
              v.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "paperflow-evidence.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>The evidence, side by side</h2>
          <p>
            Compare what your sources say. Keep every finding connected to its
            context.
          </p>
        </div>
        <div className="actions">
          <button disabled={!visible.length} onClick={exportCsv}>
            Export CSV
            <ArrowDown size={15} />
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !p.confirmed ||
              new Set(visible.map((e) => e.source_id)).size < 2
            }
            onClick={() =>
              void run("Comparing evidence across sources", () =>
                api(base + "/comparisons", "POST", {
                  source_ids: selected,
                  force: true,
                }),
              )
            }
          >
            <Sparkles size={16} />
            Compare sources
          </button>
        </div>
      </div>
      <div className="filter-panel">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Search evidence"
            placeholder="Search evidence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Evidence type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {[
            "all",
            "problem",
            "objective",
            "method",
            "sample",
            "finding",
            "limitation",
            "gap",
          ].map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "All evidence types" : k}
            </option>
          ))}
        </select>
        <span>{visible.length} items</span>
      </div>
      {p.sources.length > 0 && (
        <div className="source-filters">
          {p.sources.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked
                      ? [...ids, s.id]
                      : ids.filter((id) => id !== s.id),
                  )
                }
              />
              {s.filename}
            </label>
          ))}
          <small>
            No selection includes all sources. Comparisons use up to 80
            source-balanced items.
          </small>
        </div>
      )}
      {visible.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Evidence type</th>
                <th>Structured interpretation</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>
                    <FileText size={16} />
                    {p.sources.find((s) => s.id === e.source_id)?.filename}
                  </td>
                  <td>
                    <Badge>{e.kind}</Badge>
                  </td>
                  <td>
                    <button
                      className="evidence-content"
                      onClick={() => inspect(e)}
                    >
                      {e.content}
                    </button>
                    <p className="quote-preview">“{e.quote}”</p>
                  </td>
                  <td>
                    <button
                      className="provenance-link"
                      onClick={() => inspect(e)}
                    >
                      Page {e.page}
                      <ChevronRight size={14} />
                    </button>
                    <small>Quote verified</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<Layers3 size={28} />}
          title={
            evidence.length
              ? "No evidence matches these filters"
              : "Make the connections visible"
          }
        >
          <p>
            {evidence.length
              ? "Try a different source, type, or search term."
              : "Process your sources to build a matrix of findings, methods, limitations, and gaps."}
          </p>
          <Link className="button" to={base + "/sources"}>
            Go to sources
            <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
      {p.comparisons.length > 0 && (
        <section className="comparisons">
          <div className="section-heading">
            <h2>Across the sources</h2>
            <Badge>AI interpretation · saved comparison</Badge>
          </div>
          {p.comparisons.map((c, i) => (
            <div className="panel comparison" key={i}>
              <Badge
                tone={c.relationship === "contradiction" ? "warm" : "good"}
              >
                {c.relationship}
              </Badge>
              <p>{c.explanation}</p>
              <div className="actions">
                {c.evidence_ids.map((id) => {
                  const e = evidence.find((e) => e.id === id);
                  return e ? (
                    <button key={id} onClick={() => inspect(e)}>
                      {p.sources.find((s) => s.id === e.source_id)?.filename} ·
                      p. {e.page}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
