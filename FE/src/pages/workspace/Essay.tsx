import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { api } from "../../api";
import { Badge, Empty, Notice, Modal, readable } from "../../ui";
import type { Claim, Draft, WorkspaceProps } from "../../types";
import AiFeedback from "../../components/AiFeedback";
export default function Essay({ p, run, busy, base, inspect }: WorkspaceProps) {
  const [did, setDid] = useState(p.drafts[0]?.id || ""),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [editing, setEditing] = useState(!p.drafts.length),
    [claim, setClaim] = useState<Claim | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const draft = p.drafts.find((d) => d.id === did) || p.drafts[0];
  const activeClaim = draft?.claims.find((c) => c.id === claim?.id);
  function edit(d?: Draft) {
    setDid(d?.id || "");
    setTitle(d?.title || "");
    setText(d?.text || "");
    setEditing(true);
  }
  async function save() {
    const result = await api<{ id: string }>(
      base + "/drafts" + (did ? "/" + did : ""),
      did ? "PUT" : "POST",
      { title, text },
    );
    setDid(result.id);
    setEditing(false);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Does your evidence support your writing?</h2>
          <p>Trace the claims in your draft back to your project’s sources.</p>
        </div>
        <div className="actions">
          <button disabled={busy} onClick={() => upload.current?.click()}>
            <Upload size={16} />
            Upload draft
          </button>
          <button className="primary" disabled={busy} onClick={() => edit()}>
            <Plus size={16} />
            New draft
          </button>
        </div>
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept=".txt,.md,.pdf"
          aria-label="Upload academic draft"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void run("Reading and saving draft", async () => {
                const form = new FormData();
                form.append("file", f);
                const result = await api<{ id: string }>(
                  base + "/draft-upload",
                  "POST",
                  form,
                );
                setDid(result.id);
                setEditing(false);
              });
            e.target.value = "";
          }}
        />
      </div>
      <div className="info-banner">
        <ShieldCheck size={19} />
        <span>
          This checks evidence alignment, not writing quality. Assessments use
          your uploaded sources and need your judgment.
        </span>
      </div>
      {p.drafts.length > 0 && (
        <div className="draft-tabs">
          {p.drafts.map((d) => (
            <button
              className={draft?.id === d.id && !editing ? "active" : ""}
              key={d.id}
              onClick={() => {
                setDid(d.id);
                setEditing(false);
              }}
            >
              <FileText size={16} />
              {d.title}
              <Badge>{d.status}</Badge>
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <section className="panel draft-editor">
          <h3>
            {did ? "Edit your draft" : "Bring your writing into the workspace"}
          </h3>
          <p className="muted">
            Paste an essay, literature review, report, or thesis section.
            Editing resets this draft’s evidence check.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Saving draft", save);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Draft title
                <input
                  required
                  minLength={1}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Literature review · first draft"
                />
              </label>
              <label>
                Academic draft
                <textarea
                  rows={13}
                  required
                  minLength={20}
                  maxLength={60000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your writing here, including any in-text citations…"
                />
              </label>
              <div className="section-heading">
                <small>
                  {text.length.toLocaleString()} / 60,000 characters
                </small>
                <button className="primary">
                  Save draft
                  <Check size={16} />
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      ) : draft ? (
        <>
          <section className="draft-header panel">
            <div>
              <Badge>{draft.status}</Badge>
              <h3>{draft.title}</h3>
              <p>
                {draft.text.length.toLocaleString()} characters ·{" "}
                {draft.claims.length} extracted claims
              </p>
            </div>
            <div className="actions">
              <button disabled={busy} onClick={() => edit(draft)}>
                Edit draft
              </button>
              <button
                className="primary"
                disabled={busy || !p.confirmed}
                onClick={() =>
                  void run("Extracting and checking claims", () =>
                    api(base + "/drafts/" + draft.id + "/check", "POST", {
                      force: draft.status === "checked",
                    }),
                  )
                }
              >
                <Sparkles size={16} />
                {draft.status === "checked"
                  ? "Run a new check"
                  : "Check evidence"}
              </button>
            </div>
          </section>
          {draft.error && <Notice>{draft.error}</Notice>}
          {draft.claims.length > 0 ? (
            <>
              <div className="coverage">
                {[
                  "SUPPORTED",
                  "PARTIALLY_SUPPORTED",
                  "CONTRADICTED",
                  "UNSUPPORTED",
                  "INSUFFICIENT_EVIDENCE",
                ].map((status) => (
                  <div key={status}>
                    <strong>
                      {
                        draft.claims.filter((c) => c.check?.status === status)
                          .length
                      }
                    </strong>
                    <span>{readable(status)}</span>
                  </div>
                ))}
              </div>
              <p className="small-note">
                Coverage counts refer to extracted claims, not every sentence in
                your draft. Up to 40 claims are analyzed per draft.
              </p>
              <div className="claims-list">
                {draft.claims.map((c, i) => (
                  <button
                    className="claim-card"
                    key={c.id}
                    onClick={() => setClaim(c)}
                  >
                    <span className="claim-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <Badge
                        tone={
                          c.check?.status === "SUPPORTED"
                            ? "good"
                            : c.check?.status === "CONTRADICTED"
                              ? "bad"
                              : "warm"
                        }
                      >
                        {c.check ? readable(c.check.status) : "Awaiting check"}
                      </Badge>
                      <h3>{c.text}</h3>
                      <p>
                        {c.check?.action ||
                          "Continue the check to analyze this claim."}
                      </p>
                      <small>
                        {c.check?.matches.length || 0} evidence connections
                      </small>
                    </div>
                    <ChevronRight size={19} />
                  </button>
                ))}
              </div>
              <AiFeedback module="essay_evidence_check" projectId={p.id} resultId={draft.id} />
            </>
          ) : (
            <Empty
              icon={<FileCheck2 size={28} />}
              title={
                draft.status === "checked"
                  ? "No factual claims extracted"
                  : "Your draft is ready for an evidence check"
              }
            >
              <p>
                {draft.status === "checked"
                  ? "No meaningful research claims were identified in this text. Try a section containing factual assertions."
                  : "Confirm your topic and run the check to identify claims, supporting sources, and evidence gaps."}
              </p>
            </Empty>
          )}
          <details className="panel saved-draft">
            <summary>Read saved draft</summary>
            <p>{draft.text}</p>
          </details>
        </>
      ) : (
        <Empty title="From evidence to stronger claims">
          <p>Paste or upload a draft to begin.</p>
        </Empty>
      )}
      {activeClaim && (
        <Modal wide title="Claim evidence review" close={() => setClaim(null)}>
          <h3>{activeClaim.text}</h3>
          {activeClaim.check ? (
            <>
              <Badge
                tone={
                  activeClaim.check.status === "SUPPORTED" ? "good" : "warm"
                }
              >
                {readable(activeClaim.check.status)}
              </Badge>
              <p>{activeClaim.check.explanation}</p>
              <div className="evaluation-block">
                <h4>Topic relevance</h4>
                <p>{activeClaim.check.relevance}</p>
                <h4>Citation coverage</h4>
                <p>{activeClaim.check.citation_issue}</p>
                <h4>Evidence limitations</h4>
                <p>{activeClaim.check.limitation}</p>
                <h4>Recommended action</h4>
                <p>{activeClaim.check.action}</p>
              </div>
              <h3 className="subheading">Evidence connections</h3>
              {activeClaim.check.matches.length ? (
                activeClaim.check.matches.map((m) => {
                  const e = p.sources
                    .flatMap((s) => s.evidence)
                    .find((e) => e.id === m.evidence_id);
                  return e ? (
                    <div className="match" key={m.evidence_id}>
                      <Badge>{m.relation}</Badge>
                      <p>{m.explanation}</p>
                      <blockquote>{e.quote}</blockquote>
                      <button
                        className="text-button"
                        onClick={() => {
                          setClaim(null);
                          inspect(e);
                        }}
                      >
                        {p.sources.find((s) => s.id === e.source_id)?.filename}{" "}
                        · page {e.page}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : null;
                })
              ) : (
                <p className="muted">
                  No matching evidence was identified. This does not establish
                  that the claim is false.
                </p>
              )}
            </>
          ) : (
            <p>
              Processing has not reached this claim yet. Continue the evidence
              check.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
