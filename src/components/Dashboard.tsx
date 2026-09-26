import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmt, type Medicine, type SaleRecord } from "../data";

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-gray-400">{label}</p>
        <p className="text-2xl font-bold leading-tight text-gray-900">{value}</p>
        <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color ?? "#fff" }}>
          {entry.name === "revenue" ? fmt(entry.value) : `${entry.value} txns`}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard({ products, sales }: { products: Medicine[]; sales: SaleRecord[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((sale) => sale.transactionDate === today && sale.status === "COMPLETED");
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const lowStock = products.filter((product) => product.quantity <= product.reorderLevel && product.quantity > 0);
  const outOfStock = products.filter((product) => product.quantity === 0);
  const expiringSoon = products.filter((product) => {
    const diff = (new Date(product.expirationDate).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 90 && diff > 0;
  });

  const paymentBreakdown = Object.entries(
    todaySales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.totalAmount;
      return acc;
    }, {}),
  );

  const weeklySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en", { weekday: "short" }),
      revenue: sales
        .filter((sale) => sale.status === "COMPLETED" && sale.transactionDate === key)
        .reduce((sum, sale) => sum + sale.totalAmount, 0),
      transactions: sales.filter((sale) => sale.status === "COMPLETED" && sale.transactionDate === key).length,
    };
  });

  return (
    <div className="space-y-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Good morning, Maria 👋</h1>
          <p className="mt-0.5 text-sm text-gray-400">Pharmacy operations overview</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          System Online
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Revenue" value={fmt(todayRevenue)} sub={`${todaySales.length} transactions`} accent="bg-emerald-50 text-emerald-600" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm3.25 10.07H12.75v3.18h-1.5v-3.18H8.75v-1.5h2.5V7.93h1.5v3.14h2.5v1.5Z" /></svg>} />
        <StatCard label="Medicines" value={String(products.length)} sub={`${products.filter((product) => product.quantity > 0).length} active`} accent="bg-sky-50 text-sky-600" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Zm3 2.5h10v2H7V10Zm0 4h7v2H7v-2Z" /></svg>} />
        <StatCard label="Low Stock" value={String(lowStock.length)} sub="Need reorder" accent="bg-amber-50 text-amber-600" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm0 15a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 12 17.5Zm1.75-5.75h-3.5V7.5h3.5v4.25Z" /></svg>} />
        <StatCard label="Expiring Soon" value={String(expiringSoon.length)} sub="Under 90 days" accent="bg-rose-50 text-rose-600" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M5.5 15.5A6.5 6.5 0 1 1 18.5 15.5a6.5 6.5 0 0 1-13 0Zm7-8.25v6h2v1.5h-3.5v-7.5h1.5Z" /></svg>} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Weekly Revenue</div>
              <div className="text-xs text-slate-500">Last 7 days</div>
            </div>
            <div className="text-xs text-slate-500">Live data</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#0d9488" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 text-sm font-bold text-slate-900">Payment Mix</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => `${value}`} />
              <Line dataKey="transactions" name="Transactions" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="text-sm font-bold text-slate-900">Stock Alerts</div>
          <div className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">{lowStock.length} items</div>
        </div>
        <div className="divide-y divide-slate-100">
          {lowStock.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No stock alerts at the moment.</div>
          ) : (
            lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{item.brandName}</div>
                  <div className="text-xs text-slate-500">Reorder: {item.reorderLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-700">{item.quantity}</div>
                  <div className="text-[10px] text-slate-400">units left</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="text-sm font-bold text-slate-900">Recent Transactions</div>
          <div className="text-xs text-slate-500">{todaySales.length} today</div>
        </div>
        <div className="divide-y divide-slate-100">
          {todaySales.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No sales recorded today.</div>
          ) : (
            todaySales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{sale.id}</div>
                  <div className="text-xs text-slate-500">{sale.paymentMethod}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{fmt(sale.totalAmount)}</div>
                  <div className="text-[10px] text-slate-400">{sale.transactionTime}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
