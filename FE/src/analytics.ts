import { api } from "./api";

export type WebEvent =
  | "page_view"
  | "login"
  | "sign_up"
  | "project_create"
  | "source_upload"
  | "topic_check_complete"
  | "evidence_matrix_open"
  | "essay_check_complete"
  | "begin_checkout"
  | "purchase";

type Gtag = (command: "js" | "config" | "event", target: string | Date, params?: Record<string, unknown>) => void;
type PurchaseItem = { id: string; name: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();
let initialized = false;

/** Browser-only GA4 tag. The measurement ID is public configuration, never a secret. */
export function initializeAnalytics() {
  if (initialized || !measurementId || typeof window === "undefined") return;
  initialized = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args) {
    // gtag consumes each queued command as an argument tuple.
    window.dataLayer?.push(args);
  } as Gtag;
  // This is the standard GA4 bootstrap command; it must precede config.
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

/** Sends the initial public page view without calling the authenticated product ledger. */
export function trackPublicPageView() {
  if (!measurementId || !window.gtag) return;
  window.gtag("event", "page_view", {
    // Never include PayOS order codes, email addresses, or other query-string data.
    page_location: `${window.location.origin}${window.location.pathname}`,
  });
}

export function trackWebEvent(name: WebEvent, projectId?: string, value?: number, transactionId?: string, item?: PurchaseItem) {
  if (measurementId && window.gtag) {
    // Keep query strings (such as a PayOS return order code) out of GA4.
    // Document text, account identifiers, and uploaded-file metadata are never sent.
    const params: Record<string, unknown> = {
      page_location: `${window.location.origin}${window.location.pathname}`,
    };
    if (value !== undefined) Object.assign(params, { value, currency: "VND" });
    // GA4 uses transaction_id to deduplicate a completed purchase across sessions.
    if (name === "purchase" && transactionId) {
      params.transaction_id = transactionId;
      params.items = [{ item_id: item?.id || "paperflow-plan", item_name: item?.name || "PaperFlow plan", price: value, quantity: 1 }];
    }
    window.gtag("event", name, params);
  }
  // Purchase is only a GA4 event after the billing screen has read a verified
  // PayOS status. It is never accepted into the product event ledger.
  if (name === "purchase") return Promise.resolve(undefined);
  // Analytics failures never interrupt research, authentication, or checkout.
  return api("/analytics/events", "POST", { name, project_id: projectId }).catch(() => undefined);
}

export function trackOnce(key: string, name: WebEvent, projectId?: string, value?: number, transactionId?: string, item?: PurchaseItem) {
  const storageKey = `paperflow.analytics.${key}`;
  if (sessionStorage.getItem(storageKey)) return;
  sessionStorage.setItem(storageKey, "1");
  void trackWebEvent(name, projectId, value, transactionId, item);
}
