import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Product, SaleRecord, WEEKLY_SALES, fmt } from "../data";

const PIE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
        {label && <p className="font-semibold mb-1">{label}</p>}
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color || "#fff" }}>
            {p.name}: {p.name === "revenue" || p.name === "value" ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Reports({ sales, products }: { sales: SaleRecord[]; products: Product[] }) {
  const [dateRange, setDateRange] = useState<"today" | "week" | "all">("week");

  const filtered = sales.filter((s) => {
    if (dateRange === "today") return s.date === "2026-09-10";
    if (dateRange === "week") return s.date >= "2026-09-04";
    return true;
  }).filter(s => s.status === "completed");

  const totalRevenue = filtered.reduce((a, s) => a + s.total, 0);
  const totalDiscount = filtered.reduce((a, s) => a + s.discount, 0);
  const avgTransaction = totalRevenue / (filtered.length || 1);
  const inventoryValue = products.reduce((a, p) => a + p.price * p.stock, 0);

  const byPayment = Object.entries(
    filtered.reduce<Record<string, number>>((acc, s) => {
      acc[s.payment] = (acc[s.payment] || 0) + s.total;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const topProducts = Object.entries(
    filtered.flatMap((s) => s.items).reduce<Record<string, { qty: number; revenue: number }>>((acc, i) => {
      if (!acc[i.name]) acc[i.name] = { qty: 0, revenue: 0 };
      acc[i.name].qty += i.qty;
      acc[i.name].revenue += i.qty * i.price;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)
    .map(([name, v]) => ({ name: name.length > 22 ? name.slice(0, 22) + "…" : name, ...v }));

  const cashierStats = Object.entries(
    filtered.reduce<Record<string, { txns: number; revenue: number }>>((acc, s) => {
      if (!acc[s.cashier]) acc[s.cashier] = { txns: 0, revenue: 0 };
      acc[s.cashier].txns++;
      acc[s.cashier].revenue += s.total;
      return acc;
    }, {})
  ).map(([name, v]) => ({ name, ...v }));

  return (
    <div className="p-6 space-y-5 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">HopeMed Pharmacy · Auto-generated</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white text-sm">
            {(["today", "week", "all"] as const).map((r) => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-4 py-2 font-medium transition-colors capitalize ${dateRange === r ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {r === "today" ? "Today" : r === "week" ? "This Week" : "All Time"}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), sub: `${filtered.length} transactions`, color: "text-emerald-600" },
          { label: "Avg Transaction", value: fmt(avgTransaction), sub: "Per sale", color: "text-blue-600" },
          { label: "Total Discounts", value: fmt(totalDiscount), sub: "Given to customers", color: "text-amber-600" },
          { label: "Inventory Value", value: fmt(inventoryValue), sub: `${products.length} products`, color: "text-purple-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* Revenue Bar Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Weekly Revenue Trend</h2>
              <p className="text-xs text-gray-400">Sep 4 – Sep 10, 2026</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">+12.4% vs last week</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY_SALES} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb", radius: 6 }} />
              <Bar dataKey="revenue" name="revenue" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-1">Payment Breakdown</h2>
          <p className="text-xs text-gray-400 mb-4">By method</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={byPayment} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {byPayment.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-gray-600">{p.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{fmt(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {/* Top Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-4">Top Selling Products</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="revenue" name="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cashier Performance + Transaction Log */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900 text-sm">Cashier Performance</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {cashierStats.map((c, i) => (
                <div key={c.name} className="px-5 py-3.5 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center">{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.txns} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{fmt(c.revenue)}</p>
                    <p className="text-[10px] text-gray-400">{fmt(c.revenue / c.txns)} avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Transaction Log */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Transaction Log</h2>
          <span className="text-xs text-gray-400">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Txn ID", "Date / Time", "Items", "Subtotal", "Discount", "Total", "Payment", "Cashier"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...filtered].reverse().map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 font-medium">{s.id}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{s.date} {s.time}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{s.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(s.subtotal)}</td>
                  <td className="px-4 py-3 text-emerald-600">{s.discount > 0 ? `-${fmt(s.discount)}` : "—"}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{fmt(s.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.payment === "Cash" ? "bg-gray-100 text-gray-600" : s.payment === "GCash" ? "bg-blue-50 text-blue-700" : s.payment === "Maya" ? "bg-green-50 text-green-700" : "bg-purple-50 text-purple-700"}`}>
                      {s.payment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.cashier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
