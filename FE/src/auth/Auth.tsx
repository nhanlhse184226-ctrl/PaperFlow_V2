import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Notice, Brand, message } from "../ui";
import type { FormEvent } from "react";
import type { User } from "../types";
export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api<User>("/auth/" + (register ? "register" : "login"), "POST", {
          email: data.get("email"),
          password: data.get("password"),
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">RESEARCH, WITH DIRECTION</span>
          <h1>
            A clearer path
            <br />
            from <em>idea</em>
            <br />
            to evidence.
          </h1>
          <p>From vague research topics to citation-backed evidence.</p>
          <div className="auth-flow">
            {["Topic", "Sources", "Evidence", "Claims"].map((s, i) => (
              <span key={s}>
                {i > 0 && <ArrowRight size={14} />} {s}
              </span>
            ))}
          </div>
        </div>
        <small>
          A research readiness workspace. Built for thoughtful work.
        </small>
      </div>
      <main className="auth-form">
        <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
        <h2>{register ? "Create your workspace" : "Welcome back."}</h2>
        <p>
          {register
            ? "Give your research a place to take shape."
            : "Pick up where your research left off."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@university.edu"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              required
              placeholder="At least 12 characters"
            />
          </label>
          {error && <Notice>{error}</Notice>}
          <button className="primary wide" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to PaperFlow?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>
            Your projects and uploaded sources stay private. Hub notes are
            shared only when you publish them.
          </span>
        </div>
      </main>
    </div>
  );
}
