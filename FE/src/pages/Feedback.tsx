import { useState } from "react";
import { Bug, Lightbulb, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { api } from "../api";
import { Notice, message } from "../ui";

const types = [["BUG", "Bug", Bug], ["SUGGESTION", "Suggestion", Lightbulb], ["OTHER", "Other", MessageCircle]] as const;
export default function Feedback() {
  const [type, setType] = useState<"BUG" | "SUGGESTION" | "OTHER">("BUG"), [comment, setComment] = useState(""), [technical, setTechnical] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/feedback", "POST", { type, comment, metadata: technical ? { route: window.location.pathname, platform: "web" } : {} }); setComment(""); setSent(true); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <main className="page feedback-page"><header className="page-heading"><div><span className="eyebrow">HELP & FEEDBACK</span><h1>Help improve PaperFlow</h1><p>Report a problem or share one practical suggestion.</p></div></header>
    <section className="feedback-card"><form onSubmit={submit}><fieldset disabled={busy}><legend>What would you like to tell us?</legend><div className="feedback-type-row">{types.map(([value, label, Icon]) => <button type="button" key={value} className={type === value ? "active" : ""} aria-pressed={type === value} onClick={() => setType(value)}><Icon size={18} />{label}</button>)}</div>
      <label htmlFor="feedback-description">Description<textarea id="feedback-description" required minLength={3} maxLength={3000} rows={6} placeholder="Tell us what happened…" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <label className="feedback-technical"><input type="checkbox" checked={technical} onChange={(event) => setTechnical(event.target.checked)} /> Include page and platform information <small>Never includes your PDFs, drafts, quotes, evidence, or research content.</small></label>
      {error && <Notice><span role="alert">{error}</span></Notice>}{sent && <p className="feedback-success" role="status">Thanks — your feedback has been sent.</p>}
      <button className="primary" disabled={busy || comment.trim().length < 3}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Send feedback</button>
    </fieldset></form></section></main>;
}
