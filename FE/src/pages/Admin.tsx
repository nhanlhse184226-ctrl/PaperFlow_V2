import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Clock3,
  LogOut,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import { api } from "../api";
import { Notice, message } from "../ui";
type Trend = { day: string; revenue: number; orders: number };
type Overview = {
  revenue: number;
  paid_orders: number;
  customers: number;
  pending_orders: number;
  trend: Trend[];
  recent_orders: {
    email: string;
    plan_name: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
};
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";
export default function Admin({ logout }: { logout: () => Promise<void> }) {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      api<Overview>("/admin/overview")
        .then(setData)
        .catch((e) => setError(message(e))),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (error)
    return (
      <main className="page">
        <Notice>
          {error}
          <button onClick={load}>Thử lại</button>
        </Notice>
      </main>
    );
  if (!data)
    return (
      <main className="page">
        <div className="loading">Đang tải dashboard…</div>
      </main>
    );
  const max = Math.max(1, ...data.trend.map((item) => item.revenue));
  const metrics = [
    [ReceiptText, "Doanh thu", money(data.revenue)],
    [BarChart3, "Đơn thành công", String(data.paid_orders)],
    [UsersRound, "Khách trả phí", String(data.customers)],
    [Clock3, "Đang chờ", String(data.pending_orders)],
  ] as const;
  return (
    <main className="page admin-page">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">ADMIN · BÁO CÁO KINH DOANH</span>
          <h1>Toàn cảnh doanh thu</h1>
          <p>Chỉ tính đơn PayOS đã xác nhận.</p>
        </div>
        <div className="admin-heading-actions">
          <span className="live-badge">DỮ LIỆU THỜI GIAN THỰC</span>
          <button
            className="admin-logout"
            onClick={() => logout().catch((e) => setError(message(e)))}
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>
      <section className="admin-metrics">
        {metrics.map(([Icon, label, value]) => (
          <article key={label}>
            <span>
              <Icon size={19} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="analytics-card">
        <div className="section-heading">
          <div>
            <h2>Doanh thu 7 ngày gần nhất</h2>
            <p>VND · đơn thành công</p>
          </div>
          <span>{money(data.revenue)} tổng</span>
        </div>
        <div className="revenue-chart" aria-label="Biểu đồ doanh thu 7 ngày">
          <div className="chart-bars">
            {data.trend.map((item) => (
              <div className="chart-column" key={item.day}>
                <span>{item.revenue ? money(item.revenue) : "—"}</span>
                <i
                  style={{
                    height: `${Math.max(4, (item.revenue / max) * 100)}%`,
                  }}
                />
                <small>{item.day.slice(5)}</small>
              </div>
            ))}
          </div>
          <table className="visually-hidden">
            <caption>Doanh thu theo ngày</caption>
            <tbody>
              {data.trend.map((i) => (
                <tr key={i.day}>
                  <th>{i.day}</th>
                  <td>{money(i.revenue)}</td>
                  <td>{i.orders} đơn</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="recent-sales">
        <div className="section-heading">
          <h2>Giao dịch mới</h2>
          <span>{data.recent_orders.length} GIAO DỊCH</span>
        </div>
        {data.recent_orders.length ? (
          <div className="order-list">
            {data.recent_orders.map((o, i) => (
              <div className="order-row" key={i}>
                <div>
                  <strong>{o.email}</strong>
                  <small>
                    {o.plan_name} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("vi-VN")}
                  </small>
                </div>
                <span>{money(o.amount)}</span>
                <b className={"order-status " + o.status.toLowerCase()}>
                  {o.status}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có giao dịch PayOS.</p>
        )}
      </section>
    </main>
  );
}
