import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api, ApiError } from "./api";
import { Notice, Brand, message } from "./ui";
import type { User } from "./types";
import Auth from "./auth/Auth";
import Shell from "./layout/Shell";
import { LanguageToggle } from "./i18n";
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(message(e));
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (error)
    return (
      <div className="boot">
        <Brand />
        <Notice>{error}</Notice>
        <button onClick={load}>Retry connection</button>
      </div>
    );
  if (!user) return <><div className="auth-language"><LanguageToggle /></div><Auth onLogin={setUser} /></>;
  return (
    <>
      <Shell
        user={user}
        logout={async () => {
          await api("/auth/logout", "POST");
          setUser(null);
        }}
      />
    </>
  );
}
