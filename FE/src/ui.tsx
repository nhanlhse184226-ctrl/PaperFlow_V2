import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Layers3, X } from "lucide-react";
import type { ReactNode } from "react";
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
export const readable = (value: string) =>
  value.toLowerCase().replaceAll("_", " ");
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}

export function Empty({
  icon = <BookOpen size={28} />,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}

export function TextList({ title, items }: { title: string; items: string[] }) {
  return items.length > 0 ? (
    <section className="text-list">
      <h4>{title}</h4>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  ) : null;
}

export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Layers3 size={23} />
      </span>
      PaperFlow<span className="brand-dot">.</span>
    </Link>
  );
}

export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const current = ref.current;
    return () => current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide-modal" : "modal"}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
