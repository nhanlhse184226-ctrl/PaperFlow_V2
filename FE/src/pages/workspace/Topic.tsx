import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Compass, FileText, Sparkles, Upload, X } from "lucide-react";
import { api } from "../../api";
import { trackWebEvent } from "../../analytics";
import { Badge, Empty, TextList, Notice, message } from "../../ui";
import { useLanguage } from "../../i18n";
import AiFeedback from "../../components/AiFeedback";
import type { Analysis, Context, WorkspaceProps } from "../../types";
const pendingTranslations = new Map<string, Promise<Analysis>>();
export default function Topic({ p, run, busy, base }: WorkspaceProps) {
  const language = useLanguage();
  const file = useRef<HTMLInputElement>(null);
  const [translation, setTranslation] = useState<{
    key: string;
    analysis: Analysis;
  } | null>(null);
  const [translationError, setTranslationError] = useState("");
  const [retry, setRetry] = useState(0);
  const translationKey = JSON.stringify([base, p.analysis, language]);
  const needsTranslation =
    !!p.analysis && language !== (p.context.output_language ?? "en");
  useEffect(() => {
    let current = true;
    setTranslationError("");
    if (needsTranslation) {
      let request = pendingTranslations.get(translationKey);
      if (!request) {
        request = api<Analysis>(base + "/topic/translation", "POST", {
          language,
        });
        pendingTranslations.set(translationKey, request);
        void request
          .finally(() => pendingTranslations.delete(translationKey))
          .catch(() => {});
      }
      request
        .then((analysis) => {
          if (current) setTranslation({ key: translationKey, analysis });
        })
        .catch((error) => {
          if (current) setTranslationError(message(error));
        });
    }
    return () => {
      current = false;
    };
  }, [base, language, needsTranslation, translationKey, retry]);
  const analysis = needsTranslation
    ? translation?.key === translationKey
      ? translation.analysis
      : null
    : p.analysis;
  const [context, setContext] = useState<Context>(p.context);
  useEffect(() => setContext(p.context), [p.context]);
  const change = (key: keyof Context, value: string | number) =>
    setContext((c) => ({ ...c, [key]: value }));
  const save = () =>
    api(base + "/topic", "PUT", { ...context, output_language: language });
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await run("Uploading research documents", async () => {
      for (const item of Array.from(files)) {
        const form = new FormData();
        form.append("file", item);
        await api(base + "/sources", "POST", form);
      }
      void trackWebEvent("source_upload", p.id);
    });
  }
  return (
    <div className="topic-layout">
      <section className="panel">
        <div className="section-heading">
          <div><h2>Topic direction</h2><p>Describe the question, add the PDFs you will use, then run the evidence-grounded check.</p></div>
          <Compass size={22} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("Saving research context", save);
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Topic or working title
              <input
                required
                minLength={3}
                maxLength={300}
                value={context.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </label>
            <label>
              What do you want to explore?
              <textarea
                maxLength={5000}
                rows={4}
                value={context.description}
                onChange={(e) => change("description", e.target.value)}
                placeholder="Describe the idea, who it affects, and why it interests you."
              />
            </label>
            <label>
              Research PDFs
              <span className="field-hint">At least one readable PDF is required. The check reads the documents before evaluating source and data readiness.</span>
            </label>
            <div className="topic-upload" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) void upload(e.dataTransfer.files); }}>
              <button type="button" className="primary" onClick={() => file.current?.click()} disabled={busy}><Upload size={16} /> Add PDFs</button>
              <span>or drop them here</span>
              <input ref={file} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple aria-label="Upload research PDFs" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            </div>
            {p.sources.length > 0 && (
              <ul className="topic-documents" aria-label="Uploaded research documents">
                {p.sources.map((source) => <li key={source.id}><FileText size={16} /><span>{source.filename}</span><small>{source.page_count} pages</small><button type="button" className="icon-button" aria-label={`Remove ${source.filename}`} disabled={busy} onClick={() => void run("Removing document", () => api(base + "/sources/" + source.id, "DELETE"))}><X size={16} /></button></li>)}
              </ul>
            )}
            <div className="topic-actions">
              <button type="submit">Save context</button>
              <button
                type="button"
                className="primary"
                disabled={context.title.trim().length < 3 || !p.sources.some((source) => source.page_count > 0)}
                onClick={() =>
                  void run("Analyzing topic readiness", async () => {
                    await save();
                    await api(base + "/topic/analyze", "POST", {
                      force: !!p.analysis,
                    });
                    void trackWebEvent("topic_check_complete", p.id);
                  })
                }
              >
                <Sparkles size={16} />
                {p.analysis ? "Check direction again" : "Check direction"}
              </button>
            </div>
            <details className="context-details">
              <summary>
                Add more research context <span>Optional, but helpful</span>
              </summary>
              {(
                [
                  ["problem", "Problem statement"],
                  ["objectives", "Objectives"],
                  ["questions", "Research questions"],
                  ["skills", "Team skills"],
                  ["constraints", "Technical and project constraints"],
                ] as [keyof Context, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={2}
                    maxLength={
                      key === "skills" ||
                      key === "sources" ||
                      key === "datasets"
                        ? 2000
                        : 3000
                    }
                    value={context[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
            </details>
          </fieldset>
        </form>
      </section>
      <section className="analysis-column">
        {needsTranslation && !analysis ? (
          <div className="panel" data-no-ui-translation>
            {translationError ? (
              <Notice>
                <p>
                  {language === "vi"
                    ? "Chưa dịch được kết quả. Bản gốc vẫn được lưu an toàn."
                    : "Translation failed. The original result is preserved."}
                </p>
                <p>{translationError}</p>
                <button onClick={() => setRetry((value) => value + 1)}>
                  {language === "vi" ? "Thử dịch lại" : "Retry translation"}
                </button>
              </Notice>
            ) : (
              <p role="status">
                {language === "vi"
                  ? "Đang dịch kết quả phân tích sang tiếng Việt…"
                  : "Translating analysis into English…"}
              </p>
            )}
          </div>
        ) : analysis ? (
          <>
            <div className="panel">
              <span className="eyebrow">DIRECTION CHECK · AI ANALYSIS</span>
              <h2>A clearer view of your idea</h2>
              <p data-no-ui-translation>{analysis.summary}</p>
              <div className="dimensions">
                {analysis.dimensions.map((d) => (
                  <div className="dimension" key={d.name}>
                    <div>
                      <h4>{d.name}</h4>
                      <Badge tone={d.status === "ready" ? "good" : "warm"}>
                        {d.status}
                      </Badge>
                    </div>
                    <p data-no-ui-translation>{d.explanation}</p>
                  </div>
                ))}
              </div>
              <TextList title="Risks to plan for" items={analysis.risks} />
              <TextList
                title="What’s still unknown"
                items={analysis.missing_information}
              />
              <TextList
                title="Suggested next steps"
                items={analysis.next_steps}
              />
            </div>
            <div className="panel">
              <h3>Possible refinements</h3>
              <p className="muted">
                Choose a suggestion to edit your working title, then analyze the
                updated topic.
              </p>
              {analysis.directions.map((d) => (
                <button
                  className="direction-option"
                  key={d}
                  disabled={busy}
                  onClick={() => change("title", d.slice(0, 300))}
                >
                  {d}
                  <ArrowRight size={16} />
                </button>
              ))}
              <div className="keywords">
                {analysis.keywords.map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
              </div>
              <button
                className="primary wide"
                disabled={
                  busy ||
                  p.confirmed ||
                  JSON.stringify(context) !== JSON.stringify(p.context)
                }
                onClick={() =>
                  void run("Confirming research direction", () =>
                    api(base + "/topic/confirm", "POST"),
                  )
                }
              >
                <Check size={17} />
                {p.confirmed
                  ? "Research direction confirmed"
                  : "Confirm this direction"}
              </button>
            </div>
            <AiFeedback module="topic_analysis" projectId={p.id} resultId={p.id} />
          </>
        ) : (
          <Empty
            icon={<Compass size={30} />}
            title="Direction check"
          >
            <p>
              Add your research PDFs and run the check. The result will use
              their verified excerpts to assess your direction.
            </p>
            <span className="small-note">
              It will not replace your research judgment.
            </span>
          </Empty>
        )}
      </section>
    </div>
  );
}
