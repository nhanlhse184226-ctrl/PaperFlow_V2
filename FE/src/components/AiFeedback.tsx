import { useState } from "react";
import { Check, LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../api";
import { message } from "../ui";

const reasons = [
  ["INCORRECT", "Incorrect"],
  ["MISSING_INFORMATION", "Missing information"],
  ["CITATION_EVIDENCE", "Citation / evidence issue"],
  ["TOO_VERBOSE", "Too verbose"],
  ["OTHER", "Other"],
] as const;

export default function AiFeedback({ module, projectId, resultId }: { module: "topic_analysis" | "source_evaluation" | "compare_sources" | "essay_evidence_check"; projectId: string; resultId: string }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState<string>(""), [comment, setComment] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState<"up" | "down" | null>(null), [error, setError] = useState("");
  const submit = async (helpful: boolean) => {
    setBusy(true); setError("");
    try {
      await api("/feedback/ai", "POST", { module, project_id: projectId, result_id: resultId, helpful, reason: helpful ? undefined : reason || undefined, comment });
      setDone(helpful ? "up" : "down"); setOpen(false);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <div className="ai-feedback">
    <span>{done ? "Thanks for your feedback" : "Was this helpful?"}</span>
    <button type="button" className={done === "up" ? "selected" : ""} disabled={busy || !!done} aria-label="Helpful" onClick={() => void submit(true)}>
      {busy && !open ? <LoaderCircle className="spin" size={17} /> : <ThumbsUp size={17} />}<span>Yes</span>
    </button>
    <button type="button" className={done === "down" ? "selected" : ""} disabled={busy || !!done} aria-label="Not helpful" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <ThumbsDown size={17} /><span>No</span>
    </button>
    {open && <form className="ai-feedback-popover" onSubmit={(event) => { event.preventDefault(); if (reason) void submit(false); }}>
      <strong>What went wrong?</strong>
      <div className="feedback-reasons">{reasons.map(([value, label]) => <label key={value}><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</div>
      <label className="visually-hidden" htmlFor={`feedback-note-${resultId}`}>Additional feedback</label>
      <textarea id={`feedback-note-${resultId}`} rows={2} maxLength={1000} placeholder="Anything else? (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary" disabled={!reason || busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Submit</button>
    </form>}
  </div>;
}
