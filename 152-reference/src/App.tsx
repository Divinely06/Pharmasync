import { useEffect, useMemo, useState } from "react";
import {
  AccessArea,
  AuditLog,
  Medicine,
  PharmacyState,
  PharmacyUser,
  SaleRecord,
  Supplier,
  UserRole,
  buildAuditLog,
  calculateTotals,
  canAccess,
  fmt,
  hashPassword,
  seedState,
  WEEKLY_SALES,
} from "./data";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Page = "dashboard" | "pos" | "inventory" | "suppliers" | "users" | "audit" | "reports";

type CartItem = Medicine & { quantity: number };

const STORAGE_KEY = "pharmacy_system_state_v1";
const PIE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#22c55e"];

const navMeta: { id: Page; label: string; area: AccessArea; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", area: "DASHBOARD", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 10.5 12 3l9 7.5v9.75A1.75 1.75 0 0 1 19.25 21h-4.5v-6h-5.5v6h-4.5A1.75 1.75 0 0 1 3 20.25V10.5Z" /></svg> },
  { id: "pos", label: "Point of Sale", area: "POS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v2.25a1.5 1.5 0 0 1-1.5 1.5H18v8.25A2.25 2.25 0 0 1 15.75 19H8.25A2.25 2.25 0 0 1 6 16.75V9.25H3.5A1.5 1.5 0 0 1 2 7.75V5.5Zm4 3.75h12v7.5c0 .83-.67 1.5-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" /></svg> },
  { id: "inventory", label: "Inventory", area: "INVENTORY", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 2.25 6.75-3.38L12 3.5 5.25 6.37 12 9.75Zm-7.5 3.35 6.75 3.38v4.12l-6.75-3.38v-4.12Zm15 0v4.12l-6.75 3.38v-4.12l6.75-3.38Z" /></svg> },
  { id: "suppliers", label: "Suppliers", area: "SUPPLIERS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5v1.25h1.5A2.5 2.5 0 0 1 21 8.25v9A2.75 2.75 0 0 1 18.25 20h-12.5A2.75 2.75 0 0 1 3 17.25v-9A2.5 2.5 0 0 1 5.5 5.75H7V4.5Zm2 1.25h6v1.25H9V5.75Zm-3 2.5h12v8.5a1.25 1.25 0 0 1-1.25 1.25h-9.5A1.25 1.25 0 0 1 6 16.75v-8.5Z" /></svg> },
  { id: "users", label: "Users", area: "USERS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7.5 9.5A2.5 2.5 0 1 1 7.5 4a2.5 2.5 0 0 1 0 5.5Zm9 0A2.5 2.5 0 1 1 16.5 4a2.5 2.5 0 0 1 0 5.5ZM4 17.5c0-2.21 2.18-4 5.5-4s5.5 1.79 5.5 4v1.5H4v-1.5Zm10 0c0-1.2 1.15-2.5 3-2.5 1.2 0 2.3.34 3.1.95V19H14v-1.5Z" /></svg> },
  { id: "reports", label: "Reports", area: "REPORTS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5 3.75A1.75 1.75 0 0 1 6.75 2h10.5A1.75 1.75 0 0 1 19 3.75v16.5A1.75 1.75 0 0 1 17.25 22H6.75A1.75 1.75 0 0 1 5 20.25V3.75Zm2.5 3.5h9v1.5h-9v-1.5Zm0 4h9v1.5h-9v-1.5Zm0 4h6v1.5h-6v-1.5Z" /></svg> },
  { id: "audit", label: "Audit Logs", area: "AUDIT", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm0 4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.5A.75.75 0 0 1 12 6.75Zm0 9.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg> },
];

const defaultState = seedState();

const loadState = (): PharmacyState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return JSON.parse(raw) as PharmacyState;
  } catch {
    return defaultState;
  }
};

function App() {
  const [state, setState] = useState<PharmacyState>(loadState);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState<PharmacyUser | null>(null);
  const [login, setLogin] = useState({ username: "admin", password: "admin123" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const loginUser = (username: string, password: string) => {
    const user = state.users.find(
      (entry) => entry.username.toLowerCase() === username.toLowerCase() && entry.passwordHash === hashPassword(password) && entry.status === "ACTIVE"
    );

    if (!user) {
      return false;
    }

    setAuthUser(user);
    setState((prev) => ({
      ...prev,
      users: prev.users.map((entry) => (entry.id === user.id ? { ...entry, lastLogin: new Date().toISOString() } : entry)),
      auditLogs: [
        buildAuditLog({
          userId: user.id,
          action: "LOGIN",
          entityType: "USER",
          entityId: user.id,
          success: true,
          metadata: { username: user.username, ipAddress: "127.0.0.1" },
        }),
        ...prev.auditLogs,
      ].slice(0, 200),
    }));
    return true;
  };

  const logout = () => {
    if (authUser) {
      setState((prev) => ({
        ...prev,
        auditLogs: [
          buildAuditLog({
            userId: authUser.id,
            action: "LOGOUT",
            entityType: "USER",
            entityId: authUser.id,
            success: true,
            metadata: { username: authUser.username },
          }),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    }
    setAuthUser(null);
  };

  const currentUser = authUser ?? state.users[0];
  const visibleNav = navMeta.filter((item) => canAccess(currentUser.role, item.area));

  const lowStockCount = state.medicines.filter((item) => item.quantity <= item.reorderLevel).length;
  const todayRevenue = state.sales
    .filter((sale) => sale.transactionDate === "2026-09-10" && sale.status === "COMPLETED")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  if (!authUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ecfeff,_#f8fafc_45%,_#f1f5f9)] px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white">P</div>
            <div>
              <div className="text-xl font-bold text-slate-900">PharmaSync</div>
              <div className="text-xs text-slate-500">Pharmacy Management System</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium text-slate-500">Username</div>
            <input
              value={login.username}
              onChange={(e) => setLogin((prev) => ({ ...prev, username: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-teal-500"
            />
          </div>

          <div className="mb-6">
            <div className="text-sm font-medium text-slate-500">Password</div>
            <input
              type="password"
              value={login.password}
              onChange={(e) => setLogin((prev) => ({ ...prev, password: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-teal-500"
            />
          </div>

          <button
            onClick={() => {
              const ok = loginUser(login.username, login.password);
              if (!ok) {
                window.alert("Invalid username or password.");
              }
            }}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-teal-500"
          >
            Sign in
          </button>

          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            Demo accounts: admin / admin123 · pharmacist / pharma123 · cashier / cashier123
          </div>
        </div>
      </div>
    );
  }

  return <SystemShell {...{ state, setState, page, setPage, mobileOpen, setMobileOpen, currentUser, logout, lowStockCount, todayRevenue, visibleNav }} />;
}

function SystemShell({
  state,
  setState,
  page,
  setPage,
  mobileOpen,
  setMobileOpen,
  currentUser,
  logout,
  lowStockCount,
  todayRevenue,
  visibleNav,
}: {
  state: PharmacyState;
  setState: React.Dispatch<React.SetStateAction<PharmacyState>>;
  page: Page;
  setPage: React.Dispatch<React.SetStateAction<Page>>;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser: PharmacyUser;
  logout: () => void;
  lowStockCount: number;
  todayRevenue: number;
  visibleNav: { id: Page; label: string; area: AccessArea; icon: React.ReactNode }[];
}) {
  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">P</div>
            <div>
              <div className="text-sm font-bold text-slate-900">PharmaSync</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Operations</div>
            </div>
          </div>
        </div>

        <div className="mx-3 mt-4 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 p-4 text-white shadow-lg">
          <div className="text-[10px] uppercase tracking-[0.22em] text-teal-100">Today</div>
          <div className="mt-1 text-2xl font-bold">{fmt(todayRevenue)}</div>
          <div className="mt-1 text-xs text-teal-100">Sales captured {state.sales.filter((sale) => sale.transactionDate === "2026-09-10").length} transactions</div>
        </div>

        <nav className="space-y-1 p-3">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPage(item.id);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${page === item.id ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <span className="flex items-center gap-3">
                <span className="text-current">{item.icon}</span>
                {item.label}
              </span>
              {item.id === "inventory" && lowStockCount > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{lowStockCount}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                {currentUser.fullName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{currentUser.fullName}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{currentUser.role}</div>
              </div>
            </div>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">Logout</button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <main className="flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 md:hidden">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" /></svg>
            </button>
            <div>
              <div className="text-xl font-bold text-slate-900">{page === "dashboard" ? "Dashboard" : page === "pos" ? "Point of Sale" : page === "inventory" ? "Inventory" : page === "suppliers" ? "Suppliers" : page === "users" ? "Users" : page === "audit" ? "Audit Logs" : "Reports"}</div>
              <div className="text-xs text-slate-500">Pharmacy operations overview</div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">System Online</div>
        </header>

        <div className="h-[calc(100%-73px)] overflow-auto p-4 md:p-6">
          {page === "dashboard" && <DashboardPage state={state} />}
          {page === "pos" && <PosPage state={state} setState={setState} user={currentUser} />}
          {page === "inventory" && <InventoryPage state={state} setState={setState} />}
          {page === "suppliers" && <SuppliersPage state={state} setState={setState} />}
          {page === "users" && currentUser.role === "ADMIN" && <UsersPage state={state} setState={setState} />}
          {page === "audit" && currentUser.role === "ADMIN" && <AuditPage logs={state.auditLogs} />}
          {page === "reports" && <ReportsPage state={state} />}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ state }: { state: PharmacyState }) {
  const todaySales = state.sales.filter((sale) => sale.transactionDate === "2026-09-10");
  const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const lowStock = state.medicines.filter((item) => item.quantity <= item.reorderLevel);
  const expiringSoon = state.medicines.filter((item) => {
    const days = (new Date(item.expirationDate).getTime() - new Date("2026-09-10").getTime()) / 86400000;
    return days <= 90 && days > 0;
  });

  const paymentBreakdown = Object.entries(
    todaySales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.totalAmount;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Revenue" value={fmt(totalRevenue)} sub={`${todaySales.length} transactions`} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm3.25 10.07H12.75v3.18h-1.5v-3.18H8.75v-1.5h2.5V7.93h1.5v3.14h2.5v1.5Z" /></svg>} accent="bg-emerald-50 text-emerald-600" />
        <StatCard title="Medicines" value={String(state.medicines.length)} sub={`${state.medicines.filter((m) => m.quantity > 0).length} active`} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Zm3 2.5h10v2H7V10Zm0 4h7v2H7v-2Z" /></svg>} accent="bg-sky-50 text-sky-600" />
        <StatCard title="Low Stock" value={String(lowStock.length)} sub="Need reorder" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm0 15a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 12 17.5Zm1.75-5.75h-3.5V7.5h3.5v4.25Z" /></svg>} accent="bg-amber-50 text-amber-600" />
        <StatCard title="Expiring Soon" value={String(expiringSoon.length)} sub="Under 90 days" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M5.5 15.5A6.5 6.5 0 1 1 18.5 15.5a6.5 6.5 0 0 1-13 0Zm7-8.25v6h2v1.5h-3.5v-7.5h1.5Z" /></svg>} accent="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Weekly Revenue</div>
              <div className="text-xs text-slate-500">Last 7 days</div>
            </div>
            <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">+12.4%</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEEKLY_SALES}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${value / 1000}k`} />
              <Tooltip formatter={(value: number) => fmt(value)} />
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
              <Tooltip formatter={(value: number) => fmt(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="text-sm font-bold text-slate-900">Recent Sales</div>
            <div className="text-xs text-slate-500">Today</div>
          </div>
          <div className="divide-y divide-slate-100">
            {todaySales.slice().reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{sale.id}</div>
                  <div className="text-xs text-slate-500">{sale.transactionTime} · {sale.cashierName}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{fmt(sale.totalAmount)}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{sale.paymentMethod}</div>
                </div>
              </div>
            ))}
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
      </div>
    </div>
  );
}

function PosPage({ state, setState, user }: { state: PharmacyState; setState: React.Dispatch<React.SetStateAction<PharmacyState>>; user: PharmacyUser }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState("0");
  const [amountReceived, setAmountReceived] = useState("0");
  const [receipt, setReceipt] = useState<SaleRecord | null>(null);

  const items = state.medicines.filter((medicine) => {
    const matchCategory = category === "All" || medicine.medicineType === category;
    const matchSearch = [medicine.brandName, medicine.genericName, medicine.barcode].some((field) => field.toLowerCase().includes(search.toLowerCase()));
    return matchCategory && matchSearch && medicine.quantity > 0;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountValue = Number(discount || 0);
  const taxValue = Number((subtotal * 0.1).toFixed(2));
  const total = Number(Math.max(0, subtotal - discountValue + taxValue).toFixed(2));
  const change = Number((Number(amountReceived || 0) - total).toFixed(2));

  const addToCart = (medicine: Medicine) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === medicine.id);
      if (existing) {
        return prev.map((item) => (item.id === medicine.id ? { ...item, quantity: Math.min(item.quantity + 1, medicine.quantity) } : item));
      }
      return [...prev, { ...medicine, quantity: 1 }];
    });
  };

  const updateCartQty = (medicineId: string, nextQty: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== medicineId) return [item];
        const safeValue = Math.max(1, nextQty);
        return [{ ...item, quantity: safeValue }];
      })
    );
  };

  const removeFromCart = (medicineId: string) => setCart((prev) => prev.filter((item) => item.id !== medicineId));

  const submitSale = () => {
    if (!cart.length) return;
    if (Number(amountReceived || 0) < total && paymentMethod === "Cash") {
      window.alert("Cash amount must cover the total.");
      return;
    }

    const saleId = `TXN-${Date.now().toString().slice(-6)}`;
    const sale: SaleRecord = {
      id: saleId,
      cashierId: user.id,
      cashierName: user.fullName,
      transactionDate: "2026-09-10",
      transactionTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      subtotal,
      discount: discountValue,
      tax: taxValue,
      totalAmount: total,
      paymentMethod,
      amountReceived: Number(amountReceived || total),
      changeAmount: paymentMethod === "Cash" ? Number(Math.max(0, change).toFixed(2)) : 0,
      status: "COMPLETED",
      items: cart.map((item) => ({
        medicineId: item.id,
        medicineName: item.brandName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: Number((item.unitPrice * item.quantity).toFixed(2)),
      })),
    };

    setState((prev) => {
      const nextMedicines = prev.medicines.map((medicine) => {
        const item = cart.find((entry) => entry.id === medicine.id);
        if (!item) return medicine;
        const newQty = Math.max(0, medicine.quantity - item.quantity);
        return { ...medicine, quantity: newQty, updatedAt: new Date().toISOString() };
      });

      const nextInventory = prev.inventoryTransactions.concat(
        cart.map((item) => ({
          id: `INV-${Date.now()}-${item.id}`,
          medicineId: item.id,
          transactionType: "SALE",
          quantity: item.quantity,
          previousQuantity: prev.medicines.find((m) => m.id === item.id)?.quantity ?? 0,
          resultingQuantity: Math.max(0, (prev.medicines.find((m) => m.id === item.id)?.quantity ?? 0) - item.quantity),
          referenceId: saleId,
          performedBy: user.id,
          timestamp: new Date().toISOString(),
          notes: `POS sale ${saleId}`,
        }))
      );

      return {
        ...prev,
        medicines: nextMedicines,
        sales: [sale, ...prev.sales],
        inventoryTransactions: nextInventory,
        auditLogs: [
          buildAuditLog({
            userId: user.id,
            action: "SALE_COMPLETED",
            entityType: "SALE",
            entityId: saleId,
            success: true,
            metadata: { total: total, paymentMethod },
          }),
          ...prev.auditLogs,
        ].slice(0, 200),
      };
    });

    setReceipt(sale);
    setCart([]);
    setDiscount("0");
    setAmountReceived("0");
    setPaymentMethod("Cash");
  };

  if (receipt) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="rounded-t-3xl bg-teal-600 px-6 py-6 text-center text-white">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl">✓</div>
            <div className="text-lg font-bold">Payment Confirmed</div>
            <div className="text-xs text-teal-100">{receipt.id}</div>
          </div>
          <div className="space-y-3 p-5">
            {receipt.items.map((item) => (
              <div key={item.medicineId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{item.medicineName} × {item.quantity}</span>
                <span className="font-semibold text-slate-800">{fmt(item.subtotal)}</span>
              </div>
            ))}
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(receipt.subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Discount</span><span>-{fmt(receipt.discount)}</span></div>
              <div className="flex justify-between font-bold text-slate-900"><span>Total</span><span>{fmt(receipt.totalAmount)}</span></div>
            </div>
            <button onClick={() => setReceipt(null)} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500">New transaction</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full gap-5 xl:grid-cols-[1.5fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines or scan barcode" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-teal-500" />
          </div>
          <div className="flex flex-wrap gap-2">
            {['All', 'Antibiotics', 'Analgesics', 'Cardiovascular', 'Diabetes', 'Antihistamine', 'Antacids', 'Vitamins', 'Respiratory', 'Dermatology'].map((filter) => (
              <button key={filter} onClick={() => setCategory(filter)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === filter ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((medicine) => (
            <button key={medicine.id} onClick={() => addToCart(medicine)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm hover:border-teal-300 hover:bg-white">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">{medicine.medicineType}</span>
                <span className="text-[10px] text-slate-500">{medicine.quantity} left</span>
              </div>
              <div className="text-sm font-bold text-slate-800">{medicine.brandName}</div>
              <div className="mt-1 text-xs text-slate-500">{medicine.genericName}</div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-teal-700">{fmt(medicine.unitPrice)}</span>
                <span className="text-[10px] text-slate-500">{medicine.dosageForm}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <div className="text-sm font-bold text-slate-900">Current Order</div>
            <div className="text-xs text-slate-500">{cart.length} items</div>
          </div>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-semibold text-red-500">Clear</button>}
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-center text-sm text-slate-400">No items added yet.</div>
          ) : cart.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{item.brandName}</div>
                  <div className="text-[10px] text-slate-500">{fmt(item.unitPrice)} each</div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-xs font-medium text-red-500">Remove</button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCartQty(item.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-sm">-</button>
                  <input value={item.quantity} onChange={(e) => updateCartQty(item.id, Number(e.target.value || 1))} className="w-12 border border-slate-200 px-2 py-1 text-center text-sm" />
                  <button onClick={() => updateCartQty(item.id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-sm">+</button>
                </div>
                <div className="text-sm font-bold text-slate-800">{fmt(item.unitPrice * item.quantity)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {['Cash', 'GCash', 'Maya', 'Card'].map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Discount</label>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          {paymentMethod === 'Cash' && (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Tendered</label>
              <input value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span>Tax</span><span>{fmt(taxValue)}</span></div>
            <div className="flex items-center justify-between"><span>Discount</span><span>-{fmt(discountValue)}</span></div>
            <div className="flex items-center justify-between text-base font-bold text-slate-900"><span>Total</span><span>{fmt(total)}</span></div>
            {paymentMethod === 'Cash' && <div className="flex items-center justify-between text-sm"><span>Change</span><span>{fmt(change)}</span></div>}
          </div>

          <button onClick={submitSale} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500">Complete sale</button>
        </div>
      </div>
    </div>
  );
}

function InventoryPage({ state, setState }: { state: PharmacyState; setState: React.Dispatch<React.SetStateAction<PharmacyState>> }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "Add" | "Edit"; item?: Medicine } | null>(null);
  const [draft, setDraft] = useState<Partial<Medicine>>({});

  const filtered = state.medicines.filter((medicine) => {
    const q = search.toLowerCase();
    return [medicine.brandName, medicine.genericName, medicine.barcode, medicine.batchNumber].some((field) => field.toLowerCase().includes(q));
  });

  const openAdd = () => {
    setDraft({
      barcode: "",
      genericName: "",
      brandName: "",
      medicineType: "Antibiotic",
      dosageForm: "Tablet",
      strength: "500mg",
      prescriptionRequired: false,
      description: "",
      dosageInformation: "Reference information only: consult a licensed professional before use.",
      precautions: "Reference information only: follow label and guidance from a professional.",
      contraindications: "Reference information only: avoid using without professional advice when contraindicated.",
      storageInformation: "Store in a cool, dry place.",
      supplierId: state.suppliers[0]?.id ?? "",
      unitPrice: 0,
      quantity: 0,
      reorderLevel: 10,
      expirationDate: "2027-01-01",
      batchNumber: "",
      status: "ACTIVE",
    });
    setModal({ mode: "Add" });
  };

  const openEdit = (item: Medicine) => {
    setDraft(item);
    setModal({ mode: "Edit", item });
  };

  const saveItem = () => {
    if (!draft.brandName || !draft.genericName || !draft.barcode || !draft.batchNumber || !draft.expirationDate) {
      window.alert("Please complete all required fields.");
      return;
    }

    if (modal?.mode === "Edit" && modal.item) {
      setState((prev) => ({
        ...prev,
        medicines: prev.medicines.map((medicine) => (medicine.id === modal.item!.id ? { ...medicine, ...draft, updatedAt: new Date().toISOString() } : medicine)),
        auditLogs: [
          buildAuditLog({ userId: state.users[0].id, action: "UPDATE_MEDICINE", entityType: "MEDICINE", entityId: modal.item!.id, success: true, metadata: { brandName: draft.brandName } }),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    } else {
      const newItem: Medicine = {
        id: `med-${Date.now()}`,
        barcode: String(draft.barcode ?? ""),
        genericName: String(draft.genericName ?? ""),
        brandName: String(draft.brandName ?? ""),
        medicineType: String(draft.medicineType ?? "Antibiotic"),
        dosageForm: String(draft.dosageForm ?? "Tablet"),
        strength: String(draft.strength ?? "500mg"),
        prescriptionRequired: Boolean(draft.prescriptionRequired),
        description: String(draft.description ?? ""),
        dosageInformation: String(draft.dosageInformation ?? "Reference information only: consult a licensed professional."),
        precautions: String(draft.precautions ?? "Reference information only: follow label instructions."),
        contraindications: String(draft.contraindications ?? "Reference information only: seek professional advice."),
        storageInformation: String(draft.storageInformation ?? "Store in a cool, dry place."),
        supplierId: String(draft.supplierId ?? state.suppliers[0]?.id ?? ""),
        unitPrice: Number(draft.unitPrice ?? 0),
        quantity: Number(draft.quantity ?? 0),
        reorderLevel: Number(draft.reorderLevel ?? 10),
        expirationDate: String(draft.expirationDate ?? "2027-01-01"),
        batchNumber: String(draft.batchNumber ?? ""),
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        medicines: [newItem, ...prev.medicines],
        auditLogs: [
          buildAuditLog({ userId: state.users[0].id, action: "CREATE_MEDICINE", entityType: "MEDICINE", entityId: newItem.id, success: true, metadata: { brandName: newItem.brandName } }),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    }

    setModal(null);
    setDraft({});
  };

  const deleteItem = (itemId: string) => {
    setState((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((medicine) => medicine.id !== itemId),
      auditLogs: [
        buildAuditLog({ userId: state.users[0].id, action: "DELETE_MEDICINE", entityType: "MEDICINE", entityId: itemId, success: true, metadata: { softDelete: true } }),
        ...prev.auditLogs,
      ].slice(0, 200),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">Inventory</div>
          <div className="text-sm text-slate-500">{state.medicines.length} medicine records tracked</div>
        </div>
        <button onClick={openAdd} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-500">Add medicine</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by medicine name, barcode, batch, supplier" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((medicine) => (
                <tr key={medicine.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">{medicine.brandName}</div>
                    <div className="text-xs text-slate-500">{medicine.genericName}</div>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">{medicine.medicineType}</span></td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-800">{medicine.quantity}</div>
                    <div className="text-[10px] text-slate-500">reorder {medicine.reorderLevel}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{fmt(medicine.unitPrice)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{medicine.expirationDate}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{medicine.batchNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(medicine)} className="text-xs font-semibold text-teal-700">Edit</button>
                      <button onClick={() => deleteItem(medicine.id)} className="text-xs font-semibold text-red-500">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="text-lg font-bold text-slate-900">{modal.mode} Medicine</div>
              <button onClick={() => setModal(null)} className="text-slate-400">✕</button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Brand name" value={draft.brandName ?? ""} onChange={(value) => setDraft({ ...draft, brandName: value })} />
              <Field label="Generic name" value={draft.genericName ?? ""} onChange={(value) => setDraft({ ...draft, genericName: value })} />
              <Field label="Barcode" value={draft.barcode ?? ""} onChange={(value) => setDraft({ ...draft, barcode: value })} />
              <Field label="Batch" value={draft.batchNumber ?? ""} onChange={(value) => setDraft({ ...draft, batchNumber: value })} />
              <Field label="Strength" value={draft.strength ?? ""} onChange={(value) => setDraft({ ...draft, strength: value })} />
              <Field label="Price" type="number" value={String(draft.unitPrice ?? 0)} onChange={(value) => setDraft({ ...draft, unitPrice: Number(value) })} />
              <Field label="Quantity" type="number" value={String(draft.quantity ?? 0)} onChange={(value) => setDraft({ ...draft, quantity: Number(value) })} />
              <Field label="Reorder level" type="number" value={String(draft.reorderLevel ?? 10)} onChange={(value) => setDraft({ ...draft, reorderLevel: Number(value) })} />
              <Field label="Expiration date" type="date" value={draft.expirationDate ?? "2027-01-01"} onChange={(value) => setDraft({ ...draft, expirationDate: value })} />
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Supplier</div>
                <select value={draft.supplierId ?? state.suppliers[0]?.id ?? ""} onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Medicine type</div>
                <select value={draft.medicineType ?? "Antibiotic"} onChange={(e) => setDraft({ ...draft, medicineType: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  {['Antibiotic', 'Analgesic', 'Cardiovascular', 'Diabetes', 'Antihistamine', 'Antacid', 'Vitamin', 'Respiratory', 'Dermatology'].map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Dosage form</div>
                <select value={draft.dosageForm ?? "Tablet"} onChange={(e) => setDraft({ ...draft, dosageForm: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Inhaler'].map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Description</label>
                <textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" rows={3} />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <input type="checkbox" checked={Boolean(draft.prescriptionRequired)} onChange={(e) => setDraft({ ...draft, prescriptionRequired: e.target.checked })} />
                <span className="text-sm text-slate-700">Prescription required</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
              <button onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={saveItem} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuppliersPage({ state, setState }: { state: PharmacyState; setState: React.Dispatch<React.SetStateAction<PharmacyState>> }) {
  const [draft, setDraft] = useState<Partial<Supplier>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = () => {
    if (!draft.supplierName || !draft.phone) {
      window.alert("Supplier name and phone are required.");
      return;
    }

    if (editingId) {
      setState((prev) => ({
        ...prev,
        suppliers: prev.suppliers.map((supplier) => supplier.id === editingId ? { ...supplier, ...draft, updatedAt: new Date().toISOString() } : supplier),
      }));
    } else {
      const next: Supplier = {
        id: `sup-${Date.now()}`,
        supplierName: String(draft.supplierName),
        contactPerson: String(draft.contactPerson ?? ""),
        phone: String(draft.phone),
        email: String(draft.email ?? ""),
        address: String(draft.address ?? ""),
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, suppliers: [next, ...prev.suppliers] }));
    }
    setDraft({});
    setEditingId(null);
  };

  const remove = (id: string) => {
    setState((prev) => ({ ...prev, suppliers: prev.suppliers.filter((supplier) => supplier.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 text-lg font-bold text-slate-900">Add supplier</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Supplier name" value={draft.supplierName ?? ""} onChange={(value) => setDraft({ ...draft, supplierName: value })} />
          <Field label="Contact person" value={draft.contactPerson ?? ""} onChange={(value) => setDraft({ ...draft, contactPerson: value })} />
          <Field label="Phone" value={draft.phone ?? ""} onChange={(value) => setDraft({ ...draft, phone: value })} />
          <Field label="Email" value={draft.email ?? ""} onChange={(value) => setDraft({ ...draft, email: value })} />
          <div className="md:col-span-2">
            <Field label="Address" value={draft.address ?? ""} onChange={(value) => setDraft({ ...draft, address: value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          {editingId && <button onClick={() => { setDraft({}); setEditingId(null); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>}
          <button onClick={save} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500">{editingId ? "Update supplier" : "Save supplier"}</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 text-sm font-bold text-slate-900">Supplier list</div>
        <div className="divide-y divide-slate-100">
          {state.suppliers.map((supplier) => (
            <div key={supplier.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{supplier.supplierName}</div>
                <div className="text-xs text-slate-500">{supplier.contactPerson} · {supplier.phone}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setDraft(supplier); setEditingId(supplier.id); }} className="text-xs font-semibold text-teal-700">Edit</button>
                <button onClick={() => remove(supplier.id)} className="text-xs font-semibold text-red-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersPage({ state, setState }: { state: PharmacyState; setState: React.Dispatch<React.SetStateAction<PharmacyState>> }) {
  const [draft, setDraft] = useState<Partial<PharmacyUser & { password: string }>>({ password: "" });

  const save = () => {
    if (!draft.username || !draft.fullName || !draft.email) {
      window.alert("Username, full name and email are required.");
      return;
    }
    const nextUser: PharmacyUser = {
      id: `u-${Date.now()}`,
      username: String(draft.username),
      passwordHash: hashPassword(String(draft.password ?? "welcome123")),
      fullName: String(draft.fullName),
      role: (draft.role as UserRole) ?? "CASHIER",
      email: String(draft.email),
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null,
    };

    setState((prev) => ({ ...prev, users: [nextUser, ...prev.users] }));
    setDraft({ password: "" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 text-lg font-bold text-slate-900">Create user</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Username" value={draft.username ?? ""} onChange={(value) => setDraft({ ...draft, username: value })} />
          <Field label="Full name" value={draft.fullName ?? ""} onChange={(value) => setDraft({ ...draft, fullName: value })} />
          <Field label="Email" value={draft.email ?? ""} onChange={(value) => setDraft({ ...draft, email: value })} />
          <Field label="Password" type="password" value={draft.password ?? ""} onChange={(value) => setDraft({ ...draft, password: value })} />
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Role</div>
            <select value={draft.role ?? "CASHIER"} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              {['ADMIN', 'PHARMACIST', 'CASHIER'].map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={save} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500">Create account</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 text-sm font-bold text-slate-900">User roster</div>
        <div className="divide-y divide-slate-100">
          {state.users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-xs text-slate-500">{user.username} · {user.role}</div>
              </div>
              <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">{user.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPage({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4 text-sm font-bold text-slate-900">Audit trail</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{log.entityType} · {log.entityId}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{log.success ? 'Success' : 'Failure'}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsPage({ state }: { state: PharmacyState }) {
  const sales = state.sales.filter((sale) => sale.status === "COMPLETED");
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const inventoryValue = state.medicines.reduce((sum, medicine) => sum + medicine.unitPrice * medicine.quantity, 0);
  const totalUnits = sales.flatMap((sale) => sale.items).reduce((sum, item) => sum + item.quantity, 0);
  const lowStock = state.medicines.filter((medicine) => medicine.quantity <= medicine.reorderLevel).length;
  const reportAnchor = sales.length ? new Date(Math.max(...sales.map((sale) => new Date(sale.transactionDate).getTime()))) : new Date();
  const reportMonths = Array.from({ length: 6 }, (_, index) => new Date(reportAnchor.getFullYear(), reportAnchor.getMonth() - 5 + index, 1));
  const monthlyRevenue = reportMonths.map((date) => ({
    month: date.toLocaleString("en-US", { month: "short" }),
    revenue: sales.filter((sale) => { const saleDate = new Date(sale.transactionDate); return saleDate.getFullYear() === date.getFullYear() && saleDate.getMonth() === date.getMonth(); }).reduce((sum, sale) => sum + sale.totalAmount, 0),
  }));

  const byPayment = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.totalAmount;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const byCategory = Object.entries(
    sales.flatMap((sale) => sale.items).reduce<Record<string, number>>((acc, item) => {
      const medicine = state.medicines.find((entry) => entry.id === item.medicineId);
      const category = medicine?.medicineType ?? "Other";
      acc[category] = (acc[category] ?? 0) + item.quantity;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const topSelling = Object.entries(
    sales.flatMap((sale) => sale.items).reduce<Record<string, { quantity: number; revenue: number }>>((acc, item) => {
      const current = acc[item.medicineName] ?? { quantity: 0, revenue: 0 };
      acc[item.medicineName] = { quantity: current.quantity + item.quantity, revenue: current.revenue + item.subtotal };
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  const movement = reportMonths.map((date) => {
    const month = date.toLocaleString("en-US", { month: "short" });
    const monthSales = sales.filter((sale) => { const saleDate = new Date(sale.transactionDate); return saleDate.getFullYear() === date.getFullYear() && saleDate.getMonth() === date.getMonth(); });
    const dispensed = monthSales.flatMap((sale) => sale.items).reduce((sum, item) => sum + item.quantity, 0);
    const received = state.inventoryTransactions.filter((transaction) => { const transactionDate = new Date(transaction.timestamp); return transaction.transactionType === "PURCHASE" && transactionDate.getFullYear() === date.getFullYear() && transactionDate.getMonth() === date.getMonth(); }).reduce((sum, transaction) => sum + transaction.quantity, 0);
    return { month, dispensed, received };
  });

  const download = (name: string, rows: string[][]) => {
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSales = () => download("sales-transaction-log.csv", [["Transaction", "Date", "Cashier", "Payment", "Total"], ...sales.map((sale) => [sale.id, sale.transactionDate, sale.cashierName, sale.paymentMethod, String(sale.totalAmount)])]);
  const exportInventory = () => download("inventory-report.csv", [["Medicine", "Barcode", "Stock", "Reorder level", "Unit price", "Expiration"], ...state.medicines.map((medicine) => [medicine.brandName, medicine.barcode, String(medicine.quantity), String(medicine.reorderLevel), String(medicine.unitPrice), medicine.expirationDate])]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div><div className="text-2xl font-bold text-slate-900">Reports &amp; Analytics</div><div className="text-xs text-slate-500">Revenue, inventory movement, and sales performance</div></div>
        <button onClick={() => exportSales()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600">Export all reports</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetric label="YTD Revenue" value={fmt(totalRevenue)} note={`${sales.length} completed transactions`} color="text-teal-700" />
        <ReportMetric label="Total Transactions" value={sales.length.toLocaleString()} note="Completed sales in the system" color="text-slate-900" />
        <ReportMetric label="Medicines Dispensed" value={totalUnits.toLocaleString()} note="Units recorded on sales" color="text-slate-900" />
        <ReportMetric label="Average Basket Size" value={fmt(totalRevenue / Math.max(1, sales.length))} note={`${lowStock} low-stock items`} color="text-teal-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <ReportPanel title="Monthly Revenue" subtitle="Revenue by transaction month">
          <ResponsiveContainer width="100%" height={240}><BarChart data={monthlyRevenue}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${Number(value) / 1000}k`} /><Tooltip formatter={(value) => fmt(Number(value ?? 0))} /><Bar dataKey="revenue" radius={[5, 5, 0, 0]} fill="#0f8587" /></BarChart></ResponsiveContainer>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><div className="text-sm font-bold text-slate-900">Generate Reports</div><div className="text-xs text-slate-500">Download structured reports for inventory and business monitoring</div></div><div className="grid gap-3 md:grid-cols-2"><ReportDownload title="Monthly Inventory Report" format="CSV" description="Stock levels, reorder points, and expiration dates" onClick={exportInventory} /><ReportDownload title="Sales Transaction Log" format="CSV" description="Completed transactions and payment details" onClick={exportSales} /><ReportDownload title="Revenue Summary" format="CSV" description="Revenue totals by payment method" onClick={() => download("revenue-summary.csv", [["Payment method", "Revenue"], ...byPayment.map((entry) => [entry.name, String(entry.value)])])} /><ReportDownload title="Low Stock Alert Report" format="CSV" description="Items below their configured reorder level" onClick={() => download("low-stock-report.csv", [["Medicine", "Current stock", "Reorder level"], ...state.medicines.filter((medicine) => medicine.quantity <= medicine.reorderLevel).map((medicine) => [medicine.brandName, String(medicine.quantity), String(medicine.reorderLevel)])])} /></div></div>
    </div>
  );
}

function ReportMetric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>;
}

function ReportPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2"><div className="text-sm font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{subtitle}</div></div>{children}</div>;
}

function ReportDownload({ title, format, description, onClick }: { title: string; format: string; description: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-300 hover:bg-white"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">↓</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">{title} <span className="ml-1 rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">{format}</span></span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span></span><span className="text-xs font-bold text-teal-700">↓</span></button>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
    </div>
  );
}

function StatCard({ title, value, sub, icon, accent }: { title: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
