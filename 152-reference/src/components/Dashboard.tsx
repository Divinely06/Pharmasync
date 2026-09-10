import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Product, SaleRecord, WEEKLY_SALES, fmt } from "../data";

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name === "revenue" ? fmt(p.value) : `${p.value} txns`}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard({ products, sales }: { products: Product[]; sales: SaleRecord[] }) {
  const today = "2026-09-10";
  const todaySales = sales.filter((s) => s.date === today && s.status === "completed");
  const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel);
  const outOfStock = products.filter((p) => p.stock === 0);
  const expiringSoon = products.filter((p) => {
    const diff = (new Date(p.expiry).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 90 && diff > 0;
  });

  const paymentBreakdown = todaySales.reduce<Record<string, number>>((acc, s) => {
    acc[s.payment] = (acc[s.payment] || 0) + s.total;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Good morning, Maria 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5">Thursday, September 10, 2026 · HopeMed Pharmacy</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full font-medium">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          System Online
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Today's Revenue"
          value={fmt(todayRevenue)}
          sub={`${todaySales.length} transactions`}
          accent="bg-emerald-50 text-emerald-600"
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd"/><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z"/></svg>}
        />
        <StatCard
          label="Total Products"
          value={String(products.length)}
          sub={`${products.filter(p => p.stock > 0).length} in stock`}
          accent="bg-blue-50 text-blue-600"
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z"/><path fillRule="evenodd" d="m3.087 9 .54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087Zm6.163 3.75A.75.75 0 0 1 10 12h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Z" clipRule="evenodd"/></svg>}
        />
        <StatCard
          label="Low / Out of Stock"
          value={`${lowStock.length + outOfStock.length}`}
          sub={`${outOfStock.length} out · ${lowStock.length} low`}
          accent={lowStock.length + outOfStock.length > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"}
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 1.999-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/></svg>}
        />
        <StatCard
          label="Expiring ≤ 90 days"
          value={String(expiringSoon.length)}
          sub="Need attention"
          accent={expiringSoon.length > 0 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400"}
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd"/></svg>}
        />
      </div>

      {/* Charts Row */}
      <div className="grid xl:grid-cols-3 gap-4">
        {/* Weekly Sales Bar Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Weekly Revenue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sep 4 – Sep 10, 2026</p>
            </div>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">↑ 12.4%</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={WEEKLY_SALES} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="revenue" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction trend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Daily Transactions</h2>
              <p className="text-xs text-gray-400 mt-0.5">This week</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={WEEKLY_SALES}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="transactions" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          {/* Payment breakdown */}
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Today's Payment Methods</p>
            {Object.entries(paymentBreakdown).map(([m, amt]) => (
              <div key={m} className="flex justify-between text-xs">
                <span className="text-gray-600">{m}</span>
                <span className="font-semibold text-gray-800">{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Transactions</h2>
            <span className="text-xs text-gray-400">Today</span>
          </div>
          <div className="divide-y divide-gray-50">
            {todaySales.slice().reverse().map((s) => (
              <div key={s.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.payment === "Cash" ? "bg-gray-100 text-gray-600" : s.payment === "GCash" ? "bg-blue-50 text-blue-600" : s.payment === "Maya" ? "bg-green-50 text-green-700" : "bg-purple-50 text-purple-600"}`}>
                  {s.payment === "Cash" ? "₱" : s.payment === "GCash" ? "G" : s.payment === "Maya" ? "M" : "💳".slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{s.id}</p>
                  <p className="text-xs text-gray-400 truncate">{s.items.map(i => i.name).join(", ")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{fmt(s.total)}</p>
                  <p className="text-[10px] text-gray-400">{s.time} · {s.cashier.split(" ")[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Stock Alerts</h2>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{lowStock.length + outOfStock.length} items</span>
          </div>
          <div className="divide-y divide-gray-50">
            {outOfStock.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.supplier}</p>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>
              </div>
            ))}
            {lowStock.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">Reorder at {p.reorderLevel}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">{p.stock}</p>
                  <p className="text-[10px] text-gray-400">{p.unit}s</p>
                </div>
              </div>
            ))}
            {lowStock.length + outOfStock.length === 0 && (
              <div className="px-5 py-10 text-center text-gray-300 text-sm">All stock levels are healthy</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
