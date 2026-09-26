import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, type Medicine, type SaleRecord } from "../data";

const getWeeklyRevenue = (sales: SaleRecord[]) => {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const dailySales = sales.filter((sale) => sale.transactionDate === key && sale.status === "COMPLETED");

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dailySales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      transactions: dailySales.length,
    };
  });
};

export default function Reports({ sales, products }: { sales: SaleRecord[]; products: Medicine[] }) {
  const [range, setRange] = useState<"today" | "week" | "all">("week");

  const filtered = sales.filter((sale) => {
    if (range === "today") return sale.transactionDate === new Date().toISOString().slice(0, 10);
    return true;
  });

  const completedSales = filtered.filter((sale) => sale.status === "COMPLETED");
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalDiscount = completedSales.reduce((sum, sale) => sum + sale.discount, 0);
  const averageTransaction = completedSales.length === 0 ? 0 : totalRevenue / completedSales.length;
  const inventoryValue = products.reduce((sum, product) => sum + product.unitPrice * product.quantity, 0);

  const topProducts = Object.entries(
    completedSales.flatMap((sale) => sale.items).reduce<Record<string, { quantity: number; revenue: number }>>((acc, item) => {
      if (!acc[item.medicineName]) acc[item.medicineName] = { quantity: 0, revenue: 0 };
      acc[item.medicineName].quantity += item.quantity;
      acc[item.medicineName].revenue += item.subtotal;
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 5);

  const chartData = getWeeklyRevenue(completedSales);

  return (
    <div className="space-y-5 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-400">Pharmacy summary</p>
        </div>
        <div className="flex items-center gap-2">
          {(["today", "week", "all"] as const).map((option) => (
            <button key={option} onClick={() => setRange(option)} className={`rounded-xl px-4 py-2 text-sm font-medium ${range === option ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>
              {option === "today" ? "Today" : option === "week" ? "This Week" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub={`${completedSales.length} transactions`} color="text-emerald-600" />
        <StatCard label="Avg Transaction" value={fmt(averageTransaction)} sub="Per sale" color="text-blue-600" />
        <StatCard label="Total Discounts" value={fmt(totalDiscount)} sub="Given to customers" color="text-amber-600" />
        <StatCard label="Inventory Value" value={fmt(inventoryValue)} sub={`${products.length} products`} color="text-purple-600" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 text-sm font-bold text-slate-900">Weekly Revenue</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${Number(value) / 1000}k`} />
            <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
            <Bar dataKey="revenue" fill="#0d9488" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Top Products</h2>
          <div className="space-y-3">
            {topProducts.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between text-sm text-slate-700">
                <span>{name}</span>
                <span className="font-semibold">{value.quantity} units</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Recent Sales</h2>
          <div className="space-y-3">
            {[...completedSales].slice(-5).reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between text-sm text-slate-700">
                <span>{sale.id}</span>
                <span className="font-semibold">{fmt(sale.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-1 text-xs font-medium text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
