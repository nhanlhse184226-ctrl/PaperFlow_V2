import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, RefreshCw, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { Notice, message } from "../ui";

type Plan = { id: string; name: string; amount: number; tagline: string; highlights: string[]; sources: number; drafts: number };
type Project = { id: string; name: string; billing_enforced: boolean; plan_id: string };
type Order = { order_code: number; project_name: string; plan_name: string; amount: number; status: string; created_at: string };
type BillingData = { plans: Plan[]; projects: Project[]; orders: Order[] };
const rank: Record<string, number> = { free: 0, starter: 1, research: 2, pro: 3 };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + "đ";

export default function Billing() {
  const [data, setData] = useState<BillingData>({ plans: [], projects: [], orders: [] });
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();
  const returnedCode = Number(new URLSearchParams(location.search).get("orderCode"));
  const project = data.projects.find((item) => item.id === projectId);
  const returnedOrder = data.orders.find((item) => item.order_code === returnedCode);
  const activePlan = data.plans.find((item) => item.id === project?.plan_id);

  const load = useCallback(async () => {
    try {
      const result = await api<BillingData>("/billing/me");
      setData(result);
      setProjectId((current) => result.projects.some((item) => item.id === current)
        ? current : (result.projects.find((item) => item.billing_enforced)?.id || result.projects[0]?.id || ""));
      setError("");
    } catch (cause) { setError(message(cause)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!returnedCode || returnedOrder?.status !== "PENDING") return;
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => window.clearInterval(timer);
  }, [returnedCode, returnedOrder?.status, load]);

  async function refresh(code: number) {
    setBusy(`refresh-${code}`);
    try { await api(`/billing/orders/${code}/refresh`, "POST"); await load(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(""); }
  }
  async function choose(plan: Plan) {
    if (!project) return;
    setBusy(plan.id); setError("");
    try {
      const result = await api<{checkout_url: string}>("/billing/checkout", "POST", { project_id: project.id, plan_id: plan.id });
      window.location.assign(result.checkout_url);
    } catch (cause) { setError(message(cause)); setBusy(""); }
  }

  return <main className="page billing-page">
    <header className="pricing-hero"><div><span className="eyebrow">PAPERFLOW PLANS</span><h1>Chọn nhịp nghiên cứu của bạn.</h1><p>Mua một lần cho mỗi dự án. Thanh toán VietQR qua PayOS.</p></div><Sparkles aria-hidden="true" size={42}/></header>
    {error && <Notice>{error}</Notice>}
    {returnedCode > 0 && <section className="billing-message" aria-live="polite"><strong>{returnedOrder?.status === "PAID" ? "Thanh toán thành công" : returnedOrder?.status === "PENDING" ? "Đang chờ xác nhận thanh toán" : returnedOrder ? "Giao dịch đã kết thúc" : "Đang kiểm tra giao dịch"}</strong><span>Quyền sử dụng chỉ cập nhật khi máy chủ nhận xác nhận hợp lệ từ PayOS.</span>{returnedOrder?.status === "PENDING" && <button type="button" onClick={() => refresh(returnedCode)} disabled={!!busy}><RefreshCw size={16}/> Kiểm tra lại</button>}</section>}
    <section className="billing-project"><label htmlFor="billing-project">Dự án áp dụng gói</label>{data.projects.length ? <select id="billing-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{data.projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select> : <p>Bạn chưa có dự án. <Link to="/projects">Tạo dự án trước</Link></p>}{project && <p>{project.billing_enforced ? <>Gói hiện tại: <strong>{activePlan?.name || "Miễn phí"}</strong> · {activePlan?.sources || 1} PDF · {activePlan?.drafts || 1} bản thảo</> : "Dự án cũ giữ nguyên quyền sử dụng; không cần mua gói."}</p>}</section>
    <section className="pricing-grid" aria-label="Gói dịch vụ">{data.plans.map((plan, index) => { const available = !!project?.billing_enforced && rank[plan.id] > rank[project.plan_id]; return <article className={'price-card ' + (index === 1 ? 'featured' : '')} key={plan.id}>{index === 1 && <span className="price-popular">PHỔ BIẾN</span>}<h2>{plan.name}</h2><p>{plan.tagline}</p><strong className="price">{money(plan.amount)}</strong><ul>{plan.highlights.map((item) => <li key={item}><Check size={16} aria-hidden="true"/>{item}</li>)}</ul><button className={index === 1 ? "primary wide" : "wide"} disabled={!!busy || !available} onClick={() => choose(plan)}><CreditCard size={17}/>{!project ? "Chọn dự án" : !project.billing_enforced ? "Đã có quyền sử dụng" : !available ? "Gói đã có" : "Thanh toán VietQR"}</button></article>; })}</section>
    <section className="billing-history"><div className="section-heading"><h2>Lịch sử thanh toán</h2><span>PAYOS</span></div>{data.orders.length ? <div className="order-list">{data.orders.map((order) => <div className="order-row" key={order.order_code}><div><strong>{order.plan_name} · {order.project_name}</strong><small>#{order.order_code} · {new Date(order.created_at).toLocaleDateString("vi-VN")}</small></div><span>{money(order.amount)}</span><b className={'order-status ' + order.status.toLowerCase()}>{order.status === "PAID" ? "Đã thanh toán" : order.status === "PENDING" ? "Đang chờ" : "Đã hủy"}</b>{order.status === "PENDING" && <button type="button" onClick={() => refresh(order.order_code)} disabled={!!busy} aria-label="Kiểm tra trạng thái"><RefreshCw size={15}/></button>}</div>)}</div> : <p className="muted">Chưa có giao dịch.</p>}</section>
  </main>;
}
