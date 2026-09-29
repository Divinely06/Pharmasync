import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../data";

type DashboardChartsProps = {
  weeklySales: { day: string; revenue: number }[];
  paymentBreakdown: [string, number][];
};

const PIE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#22c55e"];

const chartCurrency = (value: number) => {
  if (value === 0) return "₱0";
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `₱${Number(thousands.toFixed(thousands < 10 ? 1 : 0))}k`;
  }
  return fmt(value);
};

export default function DashboardCharts({ weeklySales, paymentBreakdown }: DashboardChartsProps) {
  return (
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
            <YAxis domain={[0, "auto"]} tickCount={5} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => chartCurrency(Number(value ?? 0))} />
            <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#0d9488" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 text-sm font-bold text-slate-900">Payment Mix</div>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={paymentBreakdown.map(([name, value]) => ({ name, value }))} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
              {paymentBreakdown.map((entry, index) => <Cell key={entry[0]} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
