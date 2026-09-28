import { useCallback, useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, Plus, Search, Users } from "lucide-react";
import { api } from "../api";
import { Badge, Empty, Notice, Modal, message } from "../ui";
interface Note {
  id: string;
  topic: string;
  note: string;
  created_at: string;
}
export default function Hub() {
  const [notes, setNotes] = useState<Note[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [posting, setPosting] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await api<Note[]>("/hub?q=" + encodeURIComponent(query)));
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE SHARED EXPERIENCE</span>
          <h1>Topic experience hub</h1>
          <p>
            Scope notes, useful keywords, and lessons from the research process.
          </p>
        </div>
        <button className="primary" onClick={() => setPosting(true)}>
          <Plus size={17} />
          Share a note
        </button>
      </div>
      <div className="hub-banner">
        <Users size={32} />
        <div>
          <h2>Someone else may be asking a similar question.</h2>
          <p>
            Share practical experience. Hub notes are community contributions,
            not verified research evidence.
          </p>
        </div>
      </div>
      <div className="search hub-search">
        <Search size={18} />
        <input
          aria-label="Search topic notes"
          placeholder="Find a topic or research area…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && <Notice>{error}</Notice>}
      {loading ? (
        <div className="loading">
          <LoaderCircle className="spin" />
          Finding topic notes…
        </div>
      ) : notes.length ? (
        <div className="project-grid">
          {notes.map((n) => (
            <article className="panel hub-note" key={n.id}>
              <Badge>Research note</Badge>
              <h3>{n.topic}</h3>
              <p>{n.note}</p>
              <small>{new Date(n.created_at).toLocaleDateString()}</small>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon={<Users size={28} />} title="A space for useful experience">
          <p>
            Share a scope warning, data preparation tip, or question about a
            research topic.
          </p>
        </Empty>
      )}
      {posting && (
        <Modal title="Share a topic note" close={() => setPosting(false)}>
          <p>
            This note will be visible to other signed-in users. Keep private
            research and personal information out of it.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("/hub", "POST", {
                  topic: data.get("topic"),
                  note: data.get("note"),
                });
                setPosting(false);
                await load();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Topic
              <input name="topic" required minLength={3} maxLength={300} />
            </label>
            <label>
              Experience, question, or practical note
              <textarea
                name="note"
                rows={6}
                required
                minLength={10}
                maxLength={3000}
              />
            </label>
            {error && <Notice>{error}</Notice>}
            <button className="primary" disabled={busy}>
              Publish note
              <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
