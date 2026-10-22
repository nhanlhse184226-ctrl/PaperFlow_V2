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
type AnalyticsOverview = {
  days: number;
  total_users: number;
  new_users: number;
  active_users: number;
  mau: number;
  paid_users: number;
  paid_projects: number;
  conversion_rate: number;
  revenue: number;
  successful_transactions: number;
  registrations: Point[];
  activity: Point[];
  features: Feature[];
  recent_orders: Order[];
};

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
  begin_checkout: "Bắt đầu thanh toán",
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
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const load = useCallback((period: number) => api<{ analytics: AnalyticsOverview }>(`/admin/overview?days=${period}`).then((report) => setData(report.analytics)).catch((cause) => setError(message(cause))), []);
  useEffect(() => { void load(days); }, [days, load]);
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
  if (error && !data) return <main className="page"><Notice>{error}<button onClick={() => void load(days)}>Thử lại</button></Notice></main>;
  if (!data) return <main className="page"><div className="loading">Đang tải dashboard…</div></main>;
  const metrics = [
    [UsersRound, "Tổng người dùng", String(data.total_users), "Toàn hệ thống"],
    [UserPlus, "Người dùng mới", String(data.new_users), `${days} ngày · Web/Backend`],
    [Activity, "Người dùng hoạt động", String(data.active_users), `${days} ngày · Web`],
    [Activity, "MAU", String(data.mau), "30 ngày · Web"],
    [CreditCard, "Người dùng trả phí", String(data.paid_users), "Tất cả thời gian · PayOS"],
    [Percent, "Tỷ lệ chuyển đổi", `${data.conversion_rate}%`, "Tất cả thời gian · trả phí / tổng"],
    [ReceiptText, "Doanh thu", money(data.revenue), `${days} ngày · PayOS`],
    [BarChart3, "Giao dịch thành công", String(data.successful_transactions), `${days} ngày · PayOS`],
  ] as const;
  return <main className="page admin-page">
    <header className="admin-heading"><div><span className="eyebrow">ADMIN · USER ANALYTICS</span><h1>Hiệu quả sản phẩm & doanh thu</h1><p>Web Analytics là hành vi Web; thanh toán chỉ lấy từ đơn PayOS đã xác nhận, không gồm quyền demo.</p></div><div className="admin-heading-actions"><Link className="admin-logout" to="/admin/feedback"><Sparkles size={16} aria-hidden="true" /> Feedback</Link><button className="admin-logout" onClick={() => void exportPaidUsers()} disabled={exporting}><Download size={16} aria-hidden="true" /> {exporting ? "Đang xuất…" : "Xuất paid users"}</button><button className="admin-logout" onClick={() => logout().catch((cause) => setError(message(cause)))}><LogOut size={16} aria-hidden="true" /> Đăng xuất</button></div></header>
    {error && <Notice>{error}<button onClick={() => { setError(""); void load(days); }}>Thử lại</button></Notice>}
    <section className="analytics-period" aria-label="Khoảng thời gian báo cáo"><span>Khoảng thời gian</span>{([7, 30, 90] as const).map((period) => <button key={period} className={days === period ? "active" : ""} onClick={() => setDays(period)}>{period} ngày</button>)}</section>
    <section className="admin-metrics analytics-kpis">{metrics.map(([Icon, label, value, detail]) => <article key={label}><span><Icon size={19} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong><em>{detail}</em></article>)}</section>
    <section className="analytics-note"><strong>OC3:</strong> {data.paid_users} người dùng đã thanh toán thật · {data.paid_projects} dự án có gói trả phí. Chỉ số subscription không áp dụng vì PaperFlow bán gói một lần theo dự án.</section>
    <section className="admin-report-grid"><section className="analytics-card"><div className="section-heading"><div><h2>Tăng trưởng người dùng</h2><p>Tài khoản tạo mới có thời điểm đăng ký ghi nhận được.</p></div><UserPlus size={19} /></div><Bars points={data.registrations} metric="users" label="Biểu đồ tăng trưởng người dùng" /></section><section className="analytics-card"><div className="section-heading"><div><h2>Hoạt động Web</h2><p>Người dùng khác nhau mở hoặc sử dụng tính năng Web.</p></div><Activity size={19} /></div><Bars points={data.activity} metric="users" label="Biểu đồ người dùng hoạt động trên Web" /></section></section>
    <section className="admin-report-grid"><section className="analytics-card"><div className="section-heading"><div><h2>Tính năng phổ biến</h2><p>Số lượt dùng và số người dùng Web trong {days} ngày.</p></div></div>{data.features.length ? <div className="feature-list">{data.features.map((item) => <div key={item.event_name}><strong>{eventLabels[item.event_name] || item.event_name}</strong><span>{item.count} lượt · {item.users} người</span></div>)}</div> : <p className="analytics-empty">Dữ liệu tính năng bắt đầu được ghi nhận khi người dùng thao tác trên Web.</p>}</section><section className="analytics-card"><div className="section-heading"><div><h2>Marketing Analytics</h2><p>Visits, nguồn truy cập và conversion theo chiến dịch được đo bằng GA4 trên Web.</p></div></div><p className="muted">Xem Acquisition và Key events trong GA4. Dashboard này không sao chép dữ liệu GA4 để tránh sai lệch hoặc yêu cầu credential công khai.</p><a className="button" href="https://analytics.google.com/" target="_blank" rel="noreferrer">Mở Google Analytics</a></section></section>
    <section className="recent-sales"><div className="section-heading"><div><h2>Giao dịch PayOS mới</h2><p>Giao dịch thật đã xác nhận từ PayOS.</p></div><span>{data.recent_orders.length} GIAO DỊCH</span></div>{data.recent_orders.length ? <div className="order-list">{data.recent_orders.map((order, index) => <div className="order-row" key={`${order.email}-${index}`}><div><strong>{order.email}</strong><small>{order.plan_name} · {new Date(order.paid_at).toLocaleDateString("vi-VN")}</small></div><span>{money(order.amount)}</span><b className="order-status paid">PAID</b></div>)}</div> : <p className="muted">Chưa có giao dịch PayOS đã xác nhận.</p>}</section>
  </main>;
}
