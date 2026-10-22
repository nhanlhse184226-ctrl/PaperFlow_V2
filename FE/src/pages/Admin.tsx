import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Download,
  LogOut,
  ReceiptText,
  UsersRound,
  UserPlus,
  Activity,
  CreditCard,
  Percent,
  Sparkles,
} from "lucide-react";
import { api, apiUrl } from "../api";
import { Link } from "react-router-dom";
import { Notice, message } from "../ui";

type Point = { day: string; users?: number; events?: number };
type Feature = { event_name: string; count: number; users: number };
type Order = { email: string; plan_name: string; amount: number; paid_at: string };
type ReportPeriod = { kind: "days" | "month"; label: string; start: string; end: string };
type AnalyticsOverview = {
  days: number;
  period: ReportPeriod;
  total_users: number;
  new_users: number;
  active_users: number;
  dau: number;
  mau: number;
  paid_users: number;
  paid_projects: number;
  checkout_starts: number;
  conversion_rate: number | null;
  revenue: number;
  successful_transactions: number;
  registrations: Point[];
  activity: Point[];
  features: Feature[];
  recent_orders: Order[];
};

type RangeMode = "days" | "month";
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";
const eventLabels: Record<string, string> = {
  page_view: "Mở trang Web",
  login: "Đăng nhập",
  sign_up: "Đăng ký",
  project_create: "Tạo dự án",
  source_upload: "Tải tài liệu",
  topic_check_complete: "Phân tích chủ đề AI",
  evidence_matrix_open: "Mở ma trận bằng chứng",
  essay_check_complete: "Kiểm tra bài viết AI",
  begin_checkout: "Mở trang thanh toán",
  purchase: "Thanh toán thành công",
};

function Bars({ points, metric, label }: { points: Point[]; metric: "users" | "events"; label: string }) {
  const max = Math.max(1, ...points.map((point) => point[metric] || 0));
  if (!points.length) return <p className="analytics-empty">Chưa có dữ liệu trong khoảng thời gian này.</p>;
  return <div className="revenue-chart analytics-bars" aria-label={label}>{points.map((point) => {
    const value = point[metric] || 0;
    return <div className="chart-column" key={point.day} tabIndex={0} aria-label={`${point.day}: ${value}`}>
      <span>{value}</span><i style={{ height: `${Math.max(5, (value / max) * 100)}%` }} /><small>{point.day.slice(5)}</small>
    </div>;
  })}</div>;
}

export default function Admin({ logout }: { logout: () => Promise<void> }) {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("days");
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const load = useCallback((mode: RangeMode, period: number, selectedMonth: string) => {
    const query = mode === "month" ? `days=${period}&month=${encodeURIComponent(selectedMonth)}` : `days=${period}`;
    return api<{ analytics: AnalyticsOverview }>(`/admin/overview?${query}`)
      .then((report) => { setData(report.analytics); setError(""); })
      .catch((cause) => setError(message(cause)));
  }, []);
  useEffect(() => { void load(rangeMode, days, month); }, [days, load, month, rangeMode]);
  async function exportPaidUsers() {
    setExporting(true);
    try {
      const response = await fetch(apiUrl("/admin/paid-users.csv"), { credentials: "same-origin" });
      if (!response.ok) throw new Error("Không thể xuất danh sách người dùng trả phí.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "paperflow-paid-users.csv"; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(message(cause)); } finally { setExporting(false); }
  }
  if (error && !data) return <main className="page"><Notice>{error}<button onClick={() => void load(rangeMode, days, month)}>Thử lại</button></Notice></main>;
  if (!data) return <main className="page"><div className="loading">Đang tải dashboard…</div></main>;
  const rangeLabel = data.period.label;
  const conversion = data.conversion_rate === null ? "—" : `${data.conversion_rate}%`;
  const metrics = [
    [UsersRound, "Tổng người dùng", String(data.total_users), "Toàn hệ thống · không theo bộ lọc"],
    [UserPlus, "Người dùng mới", String(data.new_users), `${rangeLabel} · Web/Backend`],
    [Activity, "Người dùng hoạt động", String(data.active_users), `${rangeLabel} · Web`],
    [CreditCard, "Người dùng trả phí", String(data.paid_users), `${rangeLabel} · PayOS`],
    [Percent, "Tỷ lệ chuyển đổi", conversion, data.checkout_starts ? `${rangeLabel} · thành công / đơn thanh toán đã tạo` : `${rangeLabel} · chưa có đơn thanh toán đã tạo`],
    [ReceiptText, "Doanh thu", money(data.revenue), `${rangeLabel} · PayOS`],
    [BarChart3, "Giao dịch thành công", String(data.successful_transactions), `${rangeLabel} · PayOS`],
  ] as const;
  return <main className="page admin-page">
    <header className="admin-heading"><div><span className="eyebrow">ADMIN · USER ANALYTICS</span><h1>Hiệu quả sản phẩm & doanh thu</h1><p>Web Analytics là hành vi Web; thanh toán chỉ lấy từ đơn PayOS đã xác nhận, không gồm quyền demo.</p></div><div className="admin-heading-actions"><Link className="admin-logout" to="/admin/feedback"><Sparkles size={16} aria-hidden="true" /> Feedback</Link><button className="admin-logout" onClick={() => void exportPaidUsers()} disabled={exporting}><Download size={16} aria-hidden="true" /> {exporting ? "Đang xuất…" : "Xuất paid users"}</button><button className="admin-logout" onClick={() => logout().catch((cause) => setError(message(cause)))}><LogOut size={16} aria-hidden="true" /> Đăng xuất</button></div></header>
    {error && <Notice>{error}<button onClick={() => { setError(""); void load(rangeMode, days, month); }}>Thử lại</button></Notice>}
    <section className="analytics-period" aria-label="Khoảng thời gian báo cáo">
      <span>Khoảng theo báo cáo</span>
      {([7, 30, 90] as const).map((period) => <button key={period} className={rangeMode === "days" && days === period ? "active" : ""} aria-pressed={rangeMode === "days" && days === period} onClick={() => { setRangeMode("days"); setDays(period); }}>{period} ngày</button>)}
      <button className={rangeMode === "month" ? "active" : ""} aria-pressed={rangeMode === "month"} onClick={() => setRangeMode("month")}>Theo tháng</button>
      {rangeMode === "month" && <label className="analytics-month"><span>Chọn tháng</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Chọn tháng báo cáo" /></label>}
    </section>
    <p className="analytics-scope">Đang xem <strong>{rangeLabel}</strong> ({data.period.start} – {data.period.end}). Các KPI có nhãn “Toàn hệ thống” hoặc “chuẩn” giữ phạm vi đó để tránh trộn số liệu.</p>
    <section className="admin-metrics analytics-kpis">{metrics.map(([Icon, label, value, detail]) => <article key={label}><span><Icon size={19} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong><em>{detail}</em></article>)}</section>
    <section className="analytics-health" aria-label="Chỉ số sức khỏe Web chuẩn"><div><strong>DAU</strong><span>{data.dau}</span><small>Người dùng hoạt động hôm nay · Web</small></div><div><strong>MAU</strong><span>{data.mau}</span><small>Người dùng hoạt động 30 ngày gần nhất · Web</small></div></section>
    <section className="analytics-note"><strong>OC3 trong {rangeLabel}:</strong> {data.paid_users} người dùng đã thanh toán thật · {data.paid_projects} dự án có gói trả phí. PaperFlow bán gói một lần theo dự án nên không có chỉ số subscription.</section>
    <section className="admin-report-grid"><section className="analytics-card"><div className="section-heading"><div><h2>Tăng trưởng người dùng</h2><p>Tài khoản tạo mới trong {rangeLabel}.</p></div><UserPlus size={19} /></div><Bars points={data.registrations} metric="users" label="Biểu đồ tăng trưởng người dùng" /></section><section className="analytics-card"><div className="section-heading"><div><h2>Hoạt động Web</h2><p>Người dùng khác nhau mở hoặc sử dụng tính năng trong {rangeLabel}.</p></div><Activity size={19} /></div><Bars points={data.activity} metric="users" label="Biểu đồ người dùng hoạt động trên Web" /></section></section>
    <section className="admin-report-grid"><section className="analytics-card"><div className="section-heading"><div><h2>Tính năng phổ biến</h2><p>Số lượt dùng và số người dùng Web trong {rangeLabel}.</p></div></div>{data.features.length ? <div className="feature-list">{data.features.map((item) => <div key={item.event_name}><strong>{eventLabels[item.event_name] || item.event_name}</strong><span>{item.count} lượt · {item.users} người</span></div>)}</div> : <p className="analytics-empty">Dữ liệu tính năng bắt đầu được ghi nhận khi người dùng thao tác trên Web.</p>}</section><section className="analytics-card"><div className="section-heading"><div><h2>Marketing Analytics</h2><p>Visits, nguồn truy cập và conversion theo chiến dịch được đo bằng GA4 trên Web.</p></div></div><p className="muted">Xem Acquisition và Key events trong GA4. Dashboard này không sao chép dữ liệu GA4 để tránh sai lệch hoặc yêu cầu credential công khai.</p><a className="button" href="https://analytics.google.com/" target="_blank" rel="noreferrer">Mở Google Analytics</a></section></section>
    <section className="recent-sales"><div className="section-heading"><div><h2>Giao dịch PayOS</h2><p>Giao dịch thật đã xác nhận trong {rangeLabel}.</p></div><span>{data.recent_orders.length} GIAO DỊCH</span></div>{data.recent_orders.length ? <div className="order-list">{data.recent_orders.map((order, index) => <div className="order-row" key={`${order.email}-${index}`}><div><strong>{order.email}</strong><small>{order.plan_name} · {new Date(order.paid_at).toLocaleDateString("vi-VN")}</small></div><span>{money(order.amount)}</span><b className="order-status paid">PAID</b></div>)}</div> : <p className="muted">Chưa có giao dịch PayOS đã xác nhận trong khoảng thời gian này.</p>}</section>
  </main>;
}
