import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  FileCheck2,
  FolderOpen,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api";
import { Badge, Empty, Notice, Modal, message } from "../ui";
import type { FormEvent } from "react";
import type { Summary } from "../types";
export default function Dashboard({ all = false }: { all?: boolean }) {
  const [projects, setProjects] = useState<Summary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const navigate = useNavigate();
  const load = useCallback(() => {
    setError("");
    setLoading(true);
    api<Summary[]>("/projects")
      .then(setProjects)
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const name = new FormData(e.currentTarget).get("name");
      const p = await api<{ id: string }>("/projects", "POST", { name });
      navigate("/projects/" + p.id + "/topic");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const filtered = projects.filter((p) =>
    (p.name + " " + p.topic).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH, CONNECTED</div>
          <h1>
            {all
              ? "Research projects"
              : "A little clarity. A lot of possibility."}
          </h1>
          <p>
            {all
              ? "A home for every question worth exploring."
              : "Turn your next big question into a well-grounded research direction."}
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={18} />
          New project
        </button>
      </div>
      {!all && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <Badge>FROM IDEA TO EVIDENCE</Badge>
              <h2>
                Great research doesn’t
                <br />
                start with all the answers.
              </h2>
              <p>
                Start with a question. Find your direction, understand your
                sources, and build claims you can stand behind.
              </p>
              <button
                className="light-button"
                onClick={() => setCreating(true)}
              >
                Start your research
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-orbit" />
              <div className="paper back" />
              <div className="paper front">
                <span className="paper-label">
                  <Layers3 size={17} /> RESEARCH NOTES
                </span>
                <i />
                <i />
                <i className="short" />
                <div className="paper-highlight">
                  <Check size={16} /> Evidence connected
                </div>
                <i />
                <i className="short" />
              </div>
              <div className="art-chip">
                <ShieldCheck size={20} />
                <div>
                  Every claim.<small>A traceable source.</small>
                </div>
              </div>
              <span className="art-star">✦</span>
            </div>
          </section>
          <section className="journey">
            <div className="section-heading">
              <h2>One workspace. Four connected steps.</h2>
              <span>THE RESEARCH PATH</span>
            </div>
            <div className="journey-grid">
              {[
                {
                  icon: Compass,
                  title: "Find your direction",
                  text: "Shape a focused, feasible research topic.",
                },
                {
                  icon: BookOpen,
                  title: "Know your sources",
                  text: "Understand relevance, methods, and limits.",
                },
                {
                  icon: Layers3,
                  title: "Connect the evidence",
                  text: "Compare findings. Keep the context.",
                },
                {
                  icon: FileCheck2,
                  title: "Check your claims",
                  text: "See what your sources actually support.",
                },
              ].map((step, i) => (
                <div className="journey-step" key={step.title}>
                  <div className="step-top">
                    <step.icon size={21} />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  {i < 3 && <ChevronRight className="step-chevron" size={18} />}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <section>
        <div className="section-heading">
          <h2>
            {all ? "All projects" : "Your research projects"}{" "}
            <span className="count">{projects.length}</span>
          </h2>
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search projects"
              placeholder="Find a project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <Notice>
            {error}
            <button onClick={load}>Retry</button>
          </Notice>
        )}
        {loading ? (
          <div className="loading">
            <LoaderCircle className="spin" />
            Loading your projects…
          </div>
        ) : filtered.length ? (
          <div className="project-grid">
            {filtered.map((p) => (
              <Link
                className="project-card"
                to={"/projects/" + p.id}
                key={p.id}
              >
                <div className="card-top">
                  <span className="folder-icon">
                    <FolderOpen size={22} />
                  </span>
                  <Badge tone={p.confirmed ? "good" : ""}>
                    {p.confirmed ? "Direction confirmed" : "Exploring a topic"}
                  </Badge>
                </div>
                <h3>{p.name}</h3>
                <p>{p.topic}</p>
                <div className="project-stats">
                  <span>
                    <BookOpen size={14} />
                    {p.sources} sources
                  </span>
                  <span>
                    <Layers3 size={14} />
                    {p.evidence} evidence items
                  </span>
                </div>
                <div className="card-bottom">
                  <span>
                    Updated{" "}
                    {new Date(p.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <ArrowRight size={18} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title={
              search
                ? "No matching projects"
                : "Your next research idea belongs here"
            }
          >
            <p>
              {search
                ? "Try a different title or topic."
                : "Create a project to bring your topic, sources, evidence, and writing together."}
            </p>
            {!search && (
              <button className="primary" onClick={() => setCreating(true)}>
                <Plus size={16} />
                Create your first project
              </button>
            )}
          </Empty>
        )}
      </section>
      {creating && (
        <Modal title="A new beginning" close={() => setCreating(false)}>
          <p>
            Give your research project a name. You can refine the topic inside
            your workspace.
          </p>
          <form onSubmit={create}>
            <label>
              Project name
              <input
                name="name"
                autoFocus
                required
                minLength={3}
                maxLength={200}
                placeholder="e.g. AI feedback in programming education"
              />
            </label>
            {error && <Notice>{error}</Notice>}
            <button className="primary wide" disabled={busy}>
              Create project
              <ArrowRight size={17} />
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
