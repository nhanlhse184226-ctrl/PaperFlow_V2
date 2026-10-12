import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, Clock3, LogOut, MessageSquareText, ReceiptText, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Notice, message } from "../ui";

type Trend = { day: string; revenue: number; orders: number };
type Month = { month: string; revenue: number; orders: number };
type Overview = { revenue: number; paid_orders: number; customers: number; pending_orders: number; trend: Trend[]; months: Month[]; selected_month: string; month_trend: Trend[]; month_revenue: number; month_orders: number; recent_orders: { email: string; plan_name: string; amount: number; status: string; created_at: string }[] };
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";
const monthLabel = (month: string) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

function RevenueBars({ points, label, monthly = false }: { points: Trend[] | Month[]; label: string; monthly?: boolean }) {
  const max = Math.max(1, ...points.map((item) => item.revenue));
  if (!points.length) return <p className="analytics-empty">Chưa có đơn PayOS đã xác nhận trong khoảng thời gian này.</p>;
  return <div className="revenue-chart" aria-label={label}>
    <div className="chart-bars">{points.map((item) => {
      const key = monthly ? (item as Month).month : (item as Trend).day;
      return <div className="chart-column" key={key} tabIndex={0} aria-label={`${key}: ${money(item.revenue)}, ${item.orders} đơn`}>
        <span>{item.revenue ? money(item.revenue) : "—"}</span><i style={{ height: `${Math.max(4, (item.revenue / max) * 100)}%` }} /><small>{monthly ? key.slice(5) : key.slice(8)}</small>
      </div>;
    })}</div>
    <table className="visually-hidden"><caption>{label}</caption><tbody>{points.map((item) => { const key = monthly ? (item as Month).month : (item as Trend).day; return <tr key={key}><th>{key}</th><td>{money(item.revenue)}</td><td>{item.orders} đơn</td></tr>; })}</tbody></table>
  </div>;
}

export default function Admin({ logout }: { logout: () => Promise<void> }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const load = useCallback((month?: string) => api<Overview>(`/admin/overview${month ? `?month=${month}` : ""}`).then(setData).catch((cause) => setError(message(cause))), []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <main className="page"><Notice>{error}<button onClick={() => void load()}>Thử lại</button></Notice></main>;
  if (!data) return <main className="page"><div className="loading">Đang tải dashboard…</div></main>;
  const metrics = [[ReceiptText, "Doanh thu", money(data.revenue)], [BarChart3, "Đơn thành công", String(data.paid_orders)], [UsersRound, "Khách trả phí", String(data.customers)], [Clock3, "Đang chờ", String(data.pending_orders)]] as const;
  const months = data.months.some((item) => item.month === data.selected_month) ? data.months : [...data.months, { month: data.selected_month, revenue: 0, orders: 0 }];
  return <main className="page admin-page">
    <header className="admin-heading"><div><span className="eyebrow">ADMIN · BÁO CÁO KINH DOANH</span><h1>Toàn cảnh doanh thu</h1><p>Chỉ tính đơn PayOS đã xác nhận, không bao gồm quyền demo.</p></div><div className="admin-heading-actions"><Link className="admin-logout" to="/admin/feedback"><MessageSquareText size={16} aria-hidden="true" /> Feedback</Link><span className="live-badge">DỮ LIỆU THỜI GIAN THỰC</span><button className="admin-logout" onClick={() => logout().catch((cause) => setError(message(cause)))}><LogOut size={16} aria-hidden="true" /> Đăng xuất</button></div></header>
    <section className="admin-metrics">{metrics.map(([Icon, label, value]) => <article key={label}><span><Icon size={19} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong></article>)}</section>
    <section className="admin-report-grid"><section className="analytics-card"><div className="section-heading"><div><h2>Doanh thu 7 ngày gần nhất</h2><p>VND · đơn thành công</p></div><span>{money(data.trend.reduce((sum, item) => sum + item.revenue, 0))}</span></div><RevenueBars points={data.trend} label="Biểu đồ doanh thu bảy ngày gần nhất" /></section><section className="analytics-card"><div className="section-heading"><div><h2>Diễn biến theo tháng</h2><p>Tối đa 12 tháng có phát sinh doanh thu</p></div><CalendarDays size={19} aria-hidden="true" /></div><RevenueBars points={data.months} label="Biểu đồ doanh thu theo tháng" monthly /></section></section>
    <section className="analytics-card admin-month-report"><div className="section-heading"><div><h2>Báo cáo tháng</h2><p>Chọn một tháng để xem doanh thu theo ngày.</p></div><label className="admin-month-filter" htmlFor="revenue-month"><span>Tháng báo cáo</span><select id="revenue-month" value={data.selected_month} onChange={(event) => void load(event.target.value)}>{months.map((item) => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></label></div><div className="month-summary"><div><small>Doanh thu {monthLabel(data.selected_month)}</small><strong>{money(data.month_revenue)}</strong></div><div><small>Đơn đã xác nhận</small><strong>{data.month_orders}</strong></div></div><RevenueBars points={data.month_trend} label={`Doanh thu theo ngày trong ${monthLabel(data.selected_month)}`} /></section>
    <section className="recent-sales"><div className="section-heading"><h2>Giao dịch mới</h2><span>{data.recent_orders.length} GIAO DỊCH</span></div>{data.recent_orders.length ? <div className="order-list">{data.recent_orders.map((order, index) => <div className="order-row" key={index}><div><strong>{order.email}</strong><small>{order.plan_name} · {new Date(order.created_at).toLocaleDateString("vi-VN")}</small></div><span>{money(order.amount)}</span><b className={"order-status " + order.status.toLowerCase()}>{order.status}</b></div>)}</div> : <p className="muted">Chưa có giao dịch PayOS.</p>}</section>
  </main>;
}
