import { useEffect, useState } from "react";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import { api } from "../../api";
import { Badge, Empty, TextList, Notice, message } from "../../ui";
import { useLanguage } from "../../i18n";
import type { Analysis, Context, WorkspaceProps } from "../../types";
const pendingTranslations = new Map<string, Promise<Analysis>>();
export default function Topic({ p, run, busy, base }: WorkspaceProps) {
  const language = useLanguage();
  const [translation, setTranslation] = useState<{ key: string; analysis: Analysis } | null>(null);
  const [translationError, setTranslationError] = useState("");
  const [retry, setRetry] = useState(0);
  const translationKey = JSON.stringify([base, p.analysis, language]);
  const needsTranslation = !!p.analysis && language !== (p.context.output_language ?? "en");
  useEffect(() => {
    let current = true;
    setTranslationError("");
    if (needsTranslation) {
      let request = pendingTranslations.get(translationKey);
      if (!request) {
        request = api<Analysis>(base + "/topic/translation", "POST", { language });
        pendingTranslations.set(translationKey, request);
        void request.finally(() => pendingTranslations.delete(translationKey)).catch(() => {});
      }
      request
        .then((analysis) => { if (current) setTranslation({ key: translationKey, analysis }); })
        .catch((error) => { if (current) setTranslationError(message(error)); });
    }
    return () => { current = false; };
  }, [base, language, needsTranslation, translationKey, retry]);
  const analysis = needsTranslation
    ? (translation?.key === translationKey ? translation.analysis : null)
    : p.analysis;
  const [context, setContext] = useState<Context>(p.context);
  useEffect(() => setContext(p.context), [p.context]);
  const change = (key: keyof Context, value: string | number) =>
    setContext((c) => ({ ...c, [key]: value }));
  const save = () => api(base + "/topic", "PUT", { ...context, output_language: language });
  return (
    <div className="topic-layout">
      <section className="panel">
        <div className="section-heading">
          <h2>Shape your research question</h2>
          <Compass size={22} />
        </div>
        <p className="muted">
          Start with what you know. Uncertainty is a useful part of the process.
        </p>
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
            <div className="form-grid">
              <label>
                Team size
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={context.team_size}
                  onChange={(e) => change("team_size", Number(e.target.value))}
                />
              </label>
              <label>
                Timeline
                <input
                  maxLength={1000}
                  value={context.timeline}
                  onChange={(e) => change("timeline", e.target.value)}
                  placeholder="e.g. 12 weeks"
                />
              </label>
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
                  ["sources", "Available sources / source readiness"],
                  ["datasets", "Datasets / data readiness"],
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
            <div className="actions">
              <button type="submit">Save context</button>
              <button
                type="button"
                className="primary"
                disabled={
                  context.title.trim().length < 3 || context.team_size < 1
                }
                onClick={() =>
                  void run("Analyzing topic readiness", async () => {
                    await save();
                    await api(base + "/topic/analyze", "POST", {
                      force: !!p.analysis,
                    });
                  })
                }
              >
                <Sparkles size={16} />
                {p.analysis ? "Reanalyze topic" : "Check direction"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="analysis-column">
        {needsTranslation && !analysis ? (
          <div className="panel" data-no-ui-translation>
            {translationError ? <Notice>
              <p>{language === "vi" ? "Chưa dịch được kết quả. Bản gốc vẫn được lưu an toàn." : "Translation failed. The original result is preserved."}</p>
              <p>{translationError}</p>
              <button onClick={() => setRetry((value) => value + 1)}>{language === "vi" ? "Thử dịch lại" : "Retry translation"}</button>
            </Notice> : <p role="status">{language === "vi" ? "Đang dịch kết quả phân tích sang tiếng Việt…" : "Translating analysis into English…"}</p>}
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
          </>
        ) : (
          <Empty
            icon={<Compass size={30} />}
            title="A direction, not a verdict"
          >
            <p>
              Your topic check will explore clarity, scope, feasibility,
              researchability, source readiness, and data readiness.
            </p>
            <span className="small-note">
              Suggestions are based on the context you provide, not a live
              literature search.
            </span>
          </Empty>
        )}
      </section>
    </div>
  );
}
