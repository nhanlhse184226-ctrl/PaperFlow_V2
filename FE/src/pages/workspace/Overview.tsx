import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { api } from "../../api";
import { Badge, Modal } from "../../ui";
import type { WorkspaceProps } from "../../types";
export default function Overview({
  p,
  run,
  busy,
  base,
  onDelete,
}: WorkspaceProps & { onDelete: () => Promise<void> }) {
  const [settings, setSettings] = useState(false),
    [deleting, setDeleting] = useState(false);
  const evidence = p.sources.flatMap((s) => s.evidence),
    checked = p.drafts.filter((d) => d.status === "checked").length;
  const next = !p.confirmed
    ? [
        "topic",
        "Find your research direction",
        "Evaluate your idea and confirm a focused, feasible topic.",
      ]
    : !p.sources.length
      ? [
          "sources",
          "Bring your sources together",
          "Upload research PDFs to evaluate their relevance.",
        ]
      : p.sources.some((s) => !s.evaluation || !s.evidence_done)
        ? [
            "sources",
            "Get to know your sources",
            "Process your sources to build a grounded evidence library.",
          ]
        : !evidence.length
          ? [
              "sources",
              "Add a source with relevant evidence",
              "The processed sources yielded no verified evidence. Review them or upload another source.",
            ]
          : !p.drafts.length
            ? [
                "essay",
                "Put your claims to the test",
                "Save a draft and check its claims against your evidence.",
              ]
            : [
                "essay",
                "Review your evidence coverage",
                "Inspect supporting and contradictory evidence in your draft.",
              ];
  return (
    <>
      <section className="next-step">
        <div>
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2>{next[1]}</h2>
          <p>{next[2]}</p>
        </div>
        <Link className="button primary" to={base + "/" + next[0]}>
          Continue
          <ArrowRight size={17} />
        </Link>
      </section>
      <div className="metrics">
        {[
          ["Sources", p.sources.length],
          ["Evaluated sources", p.sources.filter((s) => s.evaluation).length],
          ["Evidence items", evidence.length],
          ["Checked drafts", checked],
        ].map(([name, n]) => (
          <div className="metric" key={name}>
            <span>{name}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel">
          <h2>Your research path</h2>
          {[
            ["Topic direction", p.confirmed, "topic"],
            [
              "Source evaluation",
              p.sources.length > 0 && p.sources.every((s) => s.evaluation),
              "sources",
            ],
            ["Evidence matrix", evidence.length > 0, "evidence"],
            ["Essay evidence check", checked > 0, "essay"],
          ].map(([label, done, route], i) => (
            <Link
              className="checklist-row"
              key={String(label)}
              to={base + "/" + route}
            >
              <span className={done ? "step-number complete" : "step-number"}>
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span>{label}</span>
              <Badge tone={done ? "good" : ""}>
                {done ? "Ready to review" : "To explore"}
              </Badge>
              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
        <section className="panel">
          <h2>Recent activity</h2>
          {p.activity.length ? (
            <ul className="activity">
              {p.activity.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Your project is ready. Start by describing your research idea.
            </p>
          )}
        </section>
      </div>
      <div className="section-heading">
        <span className="muted">
          Updated {new Date(p.updated_at).toLocaleString()}
        </span>
        <button className="text-button" onClick={() => setSettings(true)}>
          Project settings
        </button>
      </div>
      {settings && (
        <Modal title="Project settings" close={() => setSettings(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get("name");
              void run("Saving project", () => api(base, "PATCH", { name }));
              setSettings(false);
            }}
          >
            <label>
              Project name
              <input
                name="name"
                defaultValue={p.name}
                minLength={3}
                maxLength={200}
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              Save name
            </button>
          </form>
          <div className="danger-zone">
            <h4>Delete this project</h4>
            <p>Removes sources, evidence, and drafts permanently.</p>
            {deleting ? (
              <button
                className="danger"
                disabled={busy}
                onClick={() => void run("Deleting project", onDelete)}
              >
                Permanently delete project
              </button>
            ) : (
              <button className="danger" onClick={() => setDeleting(true)}>
                Delete project…
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
