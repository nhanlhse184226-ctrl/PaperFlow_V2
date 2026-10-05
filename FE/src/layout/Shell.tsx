import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  ArrowRight,
  Compass,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  CreditCard,
  Shield,
  Users,
} from "lucide-react";
import { Notice, Brand, message } from "../ui";
import type { User } from "../types";
import Dashboard from "../pages/Dashboard";
import Hub from "../pages/Hub";
import Workspace from "../pages/Workspace";
import Billing from "../pages/Billing";
import Admin from "../pages/Admin";
import { LanguageToggle, useLanguage } from "../i18n";
export default function Shell({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  const language = useLanguage();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        {language === "vi" ? "Đến nội dung chính" : "Skip to main content"}
      </a>
      <button
        ref={menuButton}
        className="mobile-menu"
        aria-label={
          language === "vi" ? "Mở hoặc đóng điều hướng" : "Toggle navigation"
        }
        aria-expanded={menu}
        aria-controls="workspace-navigation"
        onClick={() => setMenu(!menu)}
      >
        <Menu />
      </button>
      {menu && (
        <button
          className="navigation-backdrop"
          aria-label={
            language === "vi" ? "Đóng điều hướng" : "Close navigation"
          }
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        id="workspace-navigation"
        className={"sidebar " + (menu ? "open" : "")}
      >
        <Brand />
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav
          aria-label={
            language === "vi" ? "Điều hướng chính" : "Main navigation"
          }
          onClick={() => setMenu(false)}
        >
          <NavLink to="/" end>
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          <NavLink to="/projects">
            <FolderOpen size={18} />
            Research projects
          </NavLink>
          <NavLink to="/hub">
            <Users size={18} />
            Topic experience hub
          </NavLink>
          <NavLink to="/billing">
            <CreditCard size={18} />
            Plans & billing
          </NavLink>
          {user.role === "ADMIN" && (
            <NavLink to="/admin">
              <Shield size={18} />
              Admin dashboard
            </NavLink>
          )}
        </nav>
        <div className="sidebar-guide">
          <span className="small-icon">
            <Compass size={20} />
          </span>
          <h4>
            Good research starts
            <br />
            with a good question.
          </h4>
          <p>
            One connected path from an early idea to evidence you can trace.
          </p>
          <div className="tiny-flow">
            TOPIC <ArrowRight size={10} /> CLAIMS
          </div>
        </div>
        <div className="account">
          <span className="avatar">{user.email.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>My workspace</strong>
            <small title={user.email}>{user.email}</small>
          </div>
          <button
            aria-label="Sign out"
            className="icon-button"
            onClick={() => logout().catch((e) => setError(message(e)))}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>Research Readiness Workspace</span>
          <span className="topbar-note">
            <span className="green-dot" /> Thoughtful research. Traceable
            evidence.
          </span>
          <button
            type="button"
            className="topbar-logout"
            onClick={() => logout().catch((e) => setError(message(e)))}
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
          <LanguageToggle />
        </header>
        {error && <Notice>{error}</Notice>}
        <div id="workspace-content" tabIndex={-1} className="workspace-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Dashboard all />} />
            <Route path="/projects/:pid/:tab?" element={<Workspace />} />
            <Route path="/hub" element={<Hub />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/result" element={<Billing />} />
            {user.role === "ADMIN" && (
              <Route path="/admin" element={<Admin logout={logout} />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <footer className="footer">
          PAPERFLOW <span>Make every claim count.</span>
        </footer>
      </div>
    </div>
  );
}
