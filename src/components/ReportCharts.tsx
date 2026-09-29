import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../data";

type ReportChartsProps = {
  monthlyRevenue: { month: string; revenue: number }[];
  byCategory: { name: string; value: number }[];
  movement: { month: string; received: number; dispensed: number }[];
  topSelling: { id: string; name: string; quantity: number; revenue: number }[];
};

const PIE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#22c55e"];

function ReportPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2"><div className="text-sm font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{subtitle}</div></div>{children}</div>;
}

export default function ReportCharts({ monthlyRevenue, byCategory, movement, topSelling }: ReportChartsProps) {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <ReportPanel title="Monthly Revenue" subtitle="Revenue by transaction month">
          <ResponsiveContainer width="100%" height={240}><BarChart data={monthlyRevenue}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => fmt(Number(value ?? 0))} /><Tooltip formatter={(value) => fmt(Number(value ?? 0))} /><Bar dataKey="revenue" radius={[5, 5, 0, 0]} fill="#0f8587" /></BarChart></ResponsiveContainer>
        </ReportPanel>
        <ReportPanel title="Sales by Category" subtitle="Dispensed units by medicine type">
          <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>{byCategory.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer>
        </ReportPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <ReportPanel title="Stock Movement" subtitle="Received and dispensed units">
          <ResponsiveContainer width="100%" height={220}><LineChart data={movement}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="received" name="Received" stroke="#0f8587" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="dispensed" name="Dispensed" stroke="#32b4a4" strokeWidth={2} strokeDasharray="4 3" dot={false} /></LineChart></ResponsiveContainer>
        </ReportPanel>
        <ReportPanel title="Top Selling Items" subtitle="Ranked by units dispensed">
          <div className="space-y-3 pt-2">{topSelling.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">No completed sales yet.</div> : topSelling.map((item, index) => <div key={item.name}><div className="mb-1 flex items-center gap-2 text-xs"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 font-bold text-teal-700">{index + 1}</span><span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{item.name}</span><span className="font-bold text-slate-800">{item.quantity}</span></div><div className="ml-7 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(8, (item.quantity / topSelling[0].quantity) * 100)}%` }} /></div><div className="ml-7 mt-1 text-[10px] text-slate-400">{fmt(item.revenue)} revenue</div></div>)}</div>
        </ReportPanel>
      </div>
    </>
  );
}
