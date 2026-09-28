import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowRight, Check, ChevronRight, LoaderCircle } from "lucide-react";
import { api, apiUrl } from "../api";
import { Badge, Notice, Modal, message } from "../ui";
import type { Evidence, Project } from "../types";
import Overview from "./workspace/Overview";
import Topic from "./workspace/Topic";
import Sources from "./workspace/Sources";
import Matrix from "./workspace/Matrix";
import Essay from "./workspace/Essay";
export default function Workspace() {
  const { pid } = useParams();
  return <ProjectWorkspace key={pid} />;
}

function ProjectWorkspace() {
  const { pid, tab = "overview" } = useParams();
  const [p, setProject] = useState<Project | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [selected, setSelected] = useState<Evidence | null>(null),
    [pageText, setPageText] = useState("");
  const base = "/projects/" + pid;
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    const p = await api<Project>("/projects/" + pid);
    setProject(p);
  }, [pid]);
  useEffect(() => {
    setProject(null);
    reload().catch((e) => setError(message(e)));
  }, [reload]);
  useEffect(() => {
    if (!p?.operation && !busy) return;
    const timer = setInterval(() => {
      reload().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [p?.operation, busy, reload]);
  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      await reload().catch((e) => setError(message(e)));
      setBusy("");
    }
  }
  async function inspect(e: Evidence) {
    setSelected(e);
    setPageText("Loading page context…");
    try {
      const page = await api<{ text: string }>(
        base + "/sources/" + e.source_id + "/pages/" + e.page,
      );
      setPageText(page.text);
    } catch (e) {
      setPageText(message(e));
    }
  }
  if (!p)
    return (
      <main className="page">
        {error ? (
          <Notice>
            {error}
            <button onClick={() => reload().catch((e) => setError(message(e)))}>
              Retry
            </button>
          </Notice>
        ) : (
          <div className="loading">
            <LoaderCircle className="spin" />
            Opening project…
          </div>
        )}
      </main>
    );
  const props = { p, run, busy: !!busy || !!p.operation, base, inspect };
  const tabs = [
    ["overview", "Overview"],
    ["topic", "Topic direction"],
    ["sources", "Sources"],
    ["evidence", "Evidence matrix"],
    ["essay", "Essay check"],
  ];
  return (
    <main className="page workspace">
      <div className="breadcrumb">
        <Link to="/projects">Research projects</Link>
        <ChevronRight size={13} />
        <span>{p.name}</span>
      </div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RESEARCH WORKSPACE</div>
          <h1>{p.name}</h1>
          <p className="topic-summary">{p.context.title}</p>
        </div>
        <Badge tone={p.confirmed ? "good" : "warm"}>
          {p.confirmed ? (
            <>
              <Check size={13} />
              Direction confirmed
            </>
          ) : (
            "Direction in progress"
          )}
        </Badge>
      </div>
      <nav className="project-tabs">
        {tabs.map(([key, label]) => (
          <NavLink
            key={key}
            to={base + "/" + key}
            className={tab === key ? "active" : ""}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {error && (
        <Notice>
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </Notice>
      )}
      {(busy || p.operation) && (
        <div className="processing" role="status">
          <LoaderCircle className="spin" size={18} />
          {busy || p.operation?.label}
          <small>Results are saved as processing completes.</small>
        </div>
      )}
      {tab === "overview" ? (
        <Overview
          {...props}
          onDelete={async () => {
            await api(base, "DELETE");
            navigate("/projects");
          }}
        />
      ) : tab === "topic" ? (
        <Topic {...props} />
      ) : tab === "sources" ? (
        <Sources {...props} />
      ) : tab === "evidence" ? (
        <Matrix {...props} />
      ) : tab === "essay" ? (
        <Essay {...props} />
      ) : (
        <Navigate to={base + "/overview"} replace />
      )}
      {selected && (
        <Modal wide title="Follow the evidence" close={() => setSelected(null)}>
          <div className="provenance-heading">
            <Badge tone="good">Verified quotation</Badge>
            <span>
              {p.sources.find((s) => s.id === selected.source_id)?.filename} ·
              page {selected.page}
            </span>
          </div>
          <h3>{selected.content}</h3>
          <blockquote>{selected.quote}</blockquote>
          <p className="muted">
            The quotation is checked against extracted page text. The structured
            interpretation still needs your review.
          </p>
          <a
            className="button primary"
            href={apiUrl(base + "/sources/" + selected.source_id + "/file#page=" + selected.page)}
            target="_blank"
            rel="noreferrer"
          >
            Open original PDF · page {selected.page}
            <ArrowRight size={16} />
          </a>
          <details className="page-context">
            <summary>Read extracted page context</summary>
            <p>{pageText}</p>
          </details>
        </Modal>
      )}
    </main>
  );
}
