import { useEffect, useRef, useState } from "react";
import {
  AccessArea,
  AuditLog,
  Medicine,
  PharmacyState,
  PharmacyUser,
  SaleRecord,
  Supplier,
  UserRole,
  canAccess,
  fmt,
} from "./data";
import { ApiError, api, type ReceiptData, type ReportData } from "./api";
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

type Page = "dashboard" | "pos" | "inventory" | "suppliers" | "users" | "audit" | "backups" | "reports";

type CartItem = Medicine & { quantity: number };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const PIE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#22c55e"];
const pharmaBackground = "/background-phar.jpg";
const appLogo = "/dashboard-logo.png";

const navMeta: { id: Page; label: string; area: AccessArea; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", area: "DASHBOARD", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 10.5 12 3l9 7.5v9.75A1.75 1.75 0 0 1 19.25 21h-4.5v-6h-5.5v6h-4.5A1.75 1.75 0 0 1 3 20.25V10.5Z" /></svg> },
  { id: "pos", label: "Point of Sale", area: "POS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v2.25a1.5 1.5 0 0 1-1.5 1.5H18v8.25A2.25 2.25 0 0 1 15.75 19H8.25A2.25 2.25 0 0 1 6 16.75V9.25H3.5A1.5 1.5 0 0 1 2 7.75V5.5Zm4 3.75h12v7.5c0 .83-.67 1.5-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" /></svg> },
  { id: "inventory", label: "Inventory", area: "INVENTORY", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 2.25 6.75-3.38L12 3.5 5.25 6.37 12 9.75Zm-7.5 3.35 6.75 3.38v4.12l-6.75-3.38v-4.12Zm15 0v4.12l-6.75 3.38v-4.12l6.75-3.38Z" /></svg> },
  { id: "suppliers", label: "Suppliers", area: "SUPPLIERS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5v1.25h1.5A2.5 2.5 0 0 1 21 8.25v9A2.75 2.75 0 0 1 18.25 20h-12.5A2.75 2.75 0 0 1 3 17.25v-9A2.5 2.5 0 0 1 5.5 5.75H7V4.5Zm2 1.25h6v1.25H9V5.75Zm-3 2.5h12v8.5a1.25 1.25 0 0 1-1.25 1.25h-9.5A1.25 1.25 0 0 1 6 16.75v-8.5Z" /></svg> },
  { id: "users", label: "Users", area: "USERS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7.5 9.5A2.5 2.5 0 1 1 7.5 4a2.5 2.5 0 0 1 0 5.5Zm9 0A2.5 2.5 0 1 1 16.5 4a2.5 2.5 0 0 1 0 5.5ZM4 17.5c0-2.21 2.18-4 5.5-4s5.5 1.79 5.5 4v1.5H4v-1.5Zm10 0c0-1.2 1.15-2.5 3-2.5 1.2 0 2.3.34 3.1.95V19H14v-1.5Z" /></svg> },
  { id: "reports", label: "Reports", area: "REPORTS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5 3.75A1.75 1.75 0 0 1 6.75 2h10.5A1.75 1.75 0 0 1 19 3.75v16.5A1.75 1.75 0 0 1 17.25 22H6.75A1.75 1.75 0 0 1 5 20.25V3.75Zm2.5 3.5h9v1.5h-9v-1.5Zm0 4h9v1.5h-9v-1.5Zm0 4h6v1.5h-6v-1.5Z" /></svg> },
  { id: "audit", label: "Audit Logs", area: "AUDIT", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm0 4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.5A.75.75 0 0 1 12 6.75Zm0 9.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg> },
  { id: "backups", label: "Backups", area: "USERS", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 4h16v4H4V4Zm1 6h14v10H5V10Zm3 2v2h8v-2H8Zm0 4v2h5v-2H8Z" /></svg> },
];

const emptyState: PharmacyState = { users: [], suppliers: [], medicines: [], medicineBatches: [], purchases: [], purchaseItems: [], sales: [], saleItems: [], inventoryTransactions: [], auditLogs: [] };

const hydrateState = (source: PharmacyState): PharmacyState => ({
  ...source,
  sales: source.sales.map((sale) => ({
    ...sale,
    transactionTime: new Date(sale.transactionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    items: source.saleItems.filter((item) => item.saleId === sale.id).map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
  })),
});

const errorMessage = (error: unknown) => error instanceof ApiError ? `${error.message} (${error.status}${error.code ? ` · ${error.code}` : ""})` : error instanceof Error ? error.message : "The request could not be completed.";
const dateKey = (value: string | Date) => {
  const raw = value instanceof Date ? value.toISOString() : value;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
};
const today = () => dateKey(new Date());
const daysUntil = (date: string | Date) => (Date.parse(`${dateKey(date)}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000;
const isExpiringSoon = (date: string | Date) => daysUntil(date) > 0 && daysUntil(date) <= 90;
const chartCurrency = (value: number) => {
  if (value === 0) return "₱0";
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `₱${Number(thousands.toFixed(thousands < 10 ? 1 : 0))}k`;
  }
  return fmt(value);
};

function App() {
  const [state, setState] = useState<PharmacyState>(emptyState);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState<PharmacyUser | null>(null);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [appError, setAppError] = useState("");
  const [booting, setBooting] = useState(true);
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "low-stock" | "expiring-soon">("all");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { user } = await api.session();
        if (active) setAuthUser(user);
        const loaded = hydrateState(await api.state());
        if (active) setState(loaded);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401) && active) setAppError(errorMessage(error));
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const refreshData = async () => {
    const loaded = hydrateState(await api.state());
    setState(loaded);
    return loaded;
  };

  const loginUser = async () => {
    setLoginError("");
    try {
      const { user } = await api.login(login.username, login.password);
      setAuthUser(user);
      await refreshData();
    } catch (error) {
      setLoginError(errorMessage(error));
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setAuthUser(null);
      setState(emptyState);
    } catch (error) {
      setAppError(errorMessage(error));
    }
  };

  const lowStockCount = state.medicines.filter((item) => item.quantity <= item.reorderLevel).length;
  const todayRevenue = state.sales
    .filter((sale) => dateKey(sale.transactionDate) === today() && sale.status === "COMPLETED")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  if (booting) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Connecting to pharmacy service...</div>;

  if (appError && !authUser) {
    return <div className="flex min-h-screen items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-lg"><h1 className="text-lg font-bold text-slate-900">Service unavailable</h1><p className="mt-2 text-sm text-slate-600">{appError}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Retry connection</button></div></div>;
  }

  if (!authUser) {
    return (
      <div
        className="login-background relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.32), rgba(255,255,255,0.42)), url(${pharmaBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
          <div className="absolute left-5 -top-5 sm:left-8 sm:-top-3">
            <img
              src="/logo.png"
              alt="Pharmasync logo"
              className="h-40 w-40 object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.16)] sm:h-48 sm:w-48"
            />
          </div>

          <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            <div className="p-8 sm:p-10 lg:p-12">
            <div className="mb-8">
              <div className="text-xs font-bold uppercase tracking-[0.26em] text-slate-500">Pharmacy access</div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">Welcome back</div>
              <div className="mt-2 text-xs font-semibold tracking-[0.16em] text-teal-700">by Pharmasync</div>
            </div>

          <form onSubmit={(event) => { event.preventDefault(); void loginUser(); }}>
          <div className="mb-4">
                <label htmlFor="login-username" className="text-sm font-medium text-slate-500">Username</label>
            <input
                  id="login-username"
                  autoComplete="username"
                  required
                value={login.username}
              onChange={(e) => setLogin((prev) => ({ ...prev, username: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-teal-500"
            />
          </div>

          <div className="mb-6">
                <label htmlFor="login-password" className="text-sm font-medium text-slate-500">Password</label>
            <input
                  id="login-password"
              type="password"
                  autoComplete="current-password"
                  required
                value={login.password}
              onChange={(e) => setLogin((prev) => ({ ...prev, password: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={!login.username || !login.password}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-teal-500"
          >
            Sign in
          </button>
          {loginError && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{loginError}</div>}
          </form>
        </div>
      </div>
      </div>
    );
  }

  const currentUser = authUser;
  const visibleNav = navMeta.filter((item) => canAccess(currentUser.role, item.area));
  const navigate = (nextPage: Page) => {
    if (visibleNav.some((item) => item.id === nextPage)) setPage(nextPage);
  };
  const showLowStock = () => {
    setInventoryFilter("low-stock");
    navigate("inventory");
  };
  const showExpiringSoon = () => {
    setInventoryFilter("expiring-soon");
    navigate("inventory");
  };
  return <SystemShell {...{ state, page, setPage, mobileOpen, setMobileOpen, currentUser, logout, lowStockCount, todayRevenue, visibleNav, refreshData, appError, setAppError, navigate, inventoryFilter, setInventoryFilter, showLowStock, showExpiringSoon }} />;
}

function SystemShell({
  state,
  page,
  setPage,
  mobileOpen,
  setMobileOpen,
  currentUser,
  logout,
  lowStockCount,
  todayRevenue,
  visibleNav,
  refreshData,
  appError,
  setAppError,
  navigate,
  inventoryFilter,
  setInventoryFilter,
  showLowStock,
  showExpiringSoon,
}: {
  state: PharmacyState;
  page: Page;
  setPage: React.Dispatch<React.SetStateAction<Page>>;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser: PharmacyUser;
  logout: () => void;
  lowStockCount: number;
  todayRevenue: number;
  visibleNav: { id: Page; label: string; area: AccessArea; icon: React.ReactNode }[];
  refreshData: () => Promise<PharmacyState>;
  appError: string;
  setAppError: React.Dispatch<React.SetStateAction<string>>;
  navigate: (page: Page) => void;
  inventoryFilter: "all" | "low-stock" | "expiring-soon";
  setInventoryFilter: React.Dispatch<React.SetStateAction<"all" | "low-stock" | "expiring-soon">>;
  showLowStock: () => void;
  showExpiringSoon: () => void;
}) {
  return (
    <div className="app-shell flex h-screen bg-white text-slate-800">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex h-24 items-center justify-center border-b border-slate-100 px-4 py-2">
          <div className="flex items-center justify-center">
            <BrandMark className="h-20 w-40" />
          </div>
        </div>

        <div className="mx-3 mt-4 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 p-4 text-white shadow-lg">
          <div className="text-[10px] uppercase tracking-[0.22em] text-teal-100">Today</div>
          <div className="mt-1 text-2xl font-bold">{fmt(todayRevenue)}</div>
          <div className="mt-1 text-xs text-teal-100">Sales captured {state.sales.filter((sale) => dateKey(sale.transactionDate) === today()).length} transactions</div>
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
        <header className="app-header flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 md:hidden">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" /></svg>
            </button>
            <div>
              <div className="text-xl font-bold text-slate-900">{page === "dashboard" ? "Dashboard" : page === "pos" ? "Point of Sale" : page === "inventory" ? "Inventory" : page === "suppliers" ? "Suppliers" : page === "users" ? "Users" : page === "audit" ? "Audit Logs" : page === "backups" ? "Backups" : "Reports"}</div>
              <div className="text-xs text-slate-500">Pharmacy operations overview</div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">System Online</div>
        </header>

        <div className={`h-[calc(100%-73px)] overflow-auto p-4 md:p-6 ${page === "dashboard" ? "dashboard-scroll" : ""}`}>
          {page === "dashboard" && <DashboardPage state={state} onNavigate={navigate} onLowStock={showLowStock} onExpiringSoon={showExpiringSoon} />}
          {appError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{appError}</span><button onClick={() => void refreshData().then(() => setAppError("")).catch((error) => setAppError(errorMessage(error)))} className="font-semibold underline">Retry</button></div>}
          {page === "pos" && <PosPage state={state} onRefresh={refreshData} />}
          {page === "inventory" && <InventoryPage state={state} onRefresh={refreshData} lowStockOnly={inventoryFilter === "low-stock"} expiringSoonOnly={inventoryFilter === "expiring-soon"} onShowLowStock={showLowStock} onShowExpiringSoon={showExpiringSoon} onClearFilters={() => setInventoryFilter("all")} />}
          {page === "suppliers" && <SuppliersPage state={state} onRefresh={refreshData} />}
          {page === "users" && currentUser.role === "ADMIN" && <UsersPage state={state} onRefresh={refreshData} currentUser={currentUser} />}
          {page === "audit" && currentUser.role === "ADMIN" && <AuditPage />}
          {page === "backups" && currentUser.role === "ADMIN" && <BackupsPage />}
          {page === "reports" && <ReportsPage state={state} />}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ state, onNavigate, onLowStock, onExpiringSoon }: { state: PharmacyState; onNavigate: (page: Page) => void; onLowStock: () => void; onExpiringSoon: () => void }) {
  const todaySales = state.sales.filter((sale) => dateKey(sale.transactionDate) === today());
  const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const lowStock = state.medicines.filter((item) => item.quantity <= item.reorderLevel);
  const expiringSoon = state.medicines.filter((item) => isExpiringSoon(item.expirationDate));
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weeklySales = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const key = dateKey(day);
    return { day: day.toLocaleDateString("en", { weekday: "short" }), revenue: state.sales.filter((sale) => sale.status === "COMPLETED" && dateKey(sale.transactionDate) === key).reduce((sum, sale) => sum + sale.totalAmount, 0) };
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
        <StatCard title="Today's Revenue" value={fmt(totalRevenue)} sub={`${todaySales.length} transactions`} onClick={() => onNavigate("reports")} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm3.25 10.07H12.75v3.18h-1.5v-3.18H8.75v-1.5h2.5V7.93h1.5v3.14h2.5v1.5Z" /></svg>} accent="bg-emerald-50 text-emerald-600" />
        <StatCard title="Medicines" value={String(state.medicines.length)} sub={`${state.medicines.filter((m) => m.quantity > 0).length} active`} onClick={() => onNavigate("inventory")} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Zm3 2.5h10v2H7V10Zm0 4h7v2H7v-2Z" /></svg>} accent="bg-sky-50 text-sky-600" />
            <StatCard title="Low Stock" value={String(lowStock.length)} sub="Need reorder" onClick={onLowStock} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 12 2.5Zm0 15a1.25 1.25 0 1 1-1.25-1.25A1.25 1.25 0 0 1 12 17.5Zm1.75-5.75h-3.5V7.5h3.5v4.25Z" /></svg>} accent="bg-amber-50 text-amber-600" />
        <StatCard title="Expiring Soon" value={String(expiringSoon.length)} sub="Under 90 days" onClick={onExpiringSoon} icon={<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M5.5 15.5A6.5 6.5 0 1 1 18.5 15.5a6.5 6.5 0 0 1-13 0Zm7-8.25v6h2v1.5h-3.5v-7.5h1.5Z" /></svg>} accent="bg-rose-50 text-rose-600" />
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

      <div>
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

function PosPage({ state, onRefresh }: { state: PharmacyState; onRefresh: () => Promise<PharmacyState> }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"none" | "pwd" | "senior">("none");
  const [discountId, setDiscountId] = useState("");
  const [amountReceived, setAmountReceived] = useState("0");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<"thermal" | "standard">("thermal");
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [cartError, setCartError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [remoteMedicines, setRemoteMedicines] = useState<Medicine[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{ saleId: string; paymentId: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let stream: MediaStream | null = null;
    let animationFrame = 0;
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera barcode scanning is not supported here. Use a keyboard barcode scanner or type the code.");
      return () => { active = false; };
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } }).then(async (camera) => {
      if (!active) { camera.getTracks().forEach((track) => track.stop()); return; }
      stream = camera;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = camera;
      await video.play();
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
      const scan = async () => {
        if (!active) return;
        try {
          const match = (await detector.detect(video))[0];
          if (match?.rawValue) { setSearch(match.rawValue); setSearchPage(1); setScannerOpen(false); return; }
        } catch { setScannerError("Unable to read a barcode from this camera frame."); }
        animationFrame = window.requestAnimationFrame(() => void scan());
      };
      void scan();
    }).catch(() => { if (active) setScannerError("Camera permission was denied or no camera is available."); });
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scannerOpen]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      void api.searchMedicines(search.trim(), searchPage, 30).then((result) => {
        if (!active) return;
        setRemoteMedicines((previous) => searchPage === 1 ? result.medicines : [...previous, ...result.medicines.filter((medicine) => !previous.some((entry) => entry.id === medicine.id))]);
        setSearchTotal(result.total);
      }).catch((error) => { if (active) setSearchError(errorMessage(error)); }).finally(() => { if (active) setSearchLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, searchPage]);

  const availableStock = (medicineId: string) => state.medicineBatches
    .filter((batch) => batch.medicineId === medicineId && batch.quantity > 0 && batch.expirationDate >= today())
    .reduce((total, batch) => total + batch.quantity, 0);

  const items = remoteMedicines.filter((medicine) => {
    const matchCategory = category === "All" || medicine.medicineType === category;
    return matchCategory && availableStock(medicine.id) > 0;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const requestedDiscount = Number(discount || 0);
  const manualDiscountValue = Math.max(0, Number.isFinite(requestedDiscount) ? requestedDiscount : 0);
  const qualifiedDiscount = discountType !== "none" && discountId.trim() ? subtotal * 0.2 : 0;
  const discountValue = Math.min(subtotal, discountType !== "none" ? qualifiedDiscount : manualDiscountValue);
  const taxValue = Number((subtotal * 0.1).toFixed(2));
  const total = Number(Math.max(0, subtotal - discountValue + taxValue).toFixed(2));
  const change = Number((Number(amountReceived || 0) - total).toFixed(2));

  const addToCart = (medicine: Medicine) => {
    setCartError("");
    setCart((prev) => {
      const existing = prev.find((item) => item.id === medicine.id);
      if (existing) {
        if (existing.quantity >= availableStock(medicine.id)) {
          setCartError("Insufficient stock available.");
          return prev;
        }
        return prev.map((item) => (item.id === medicine.id ? { ...item, quantity: Math.min(item.quantity + 1, availableStock(medicine.id)) } : item));
      }
      return [...prev, { ...medicine, quantity: 1 }];
    });
  };

  const updateCartQty = (medicineId: string, nextQty: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== medicineId) return [item];
        const available = availableStock(medicineId);
        const safeValue = Math.min(available, Math.max(1, Math.floor(nextQty || 1)));
        if (safeValue < nextQty) setCartError("Insufficient stock available.");
        return [{ ...item, quantity: safeValue }];
      })
    );
  };

  const removeFromCart = (medicineId: string) => setCart((prev) => prev.filter((item) => item.id !== medicineId));

  const completeSale = async (saleId: string) => {
    const loaded = await onRefresh();
    const sale = loaded.sales.find((entry) => entry.id === saleId);
    if (!sale) throw new Error("The sale was completed, but its receipt details could not be loaded.");
    setReceipt({
      ...sale,
      paymentStatus: sale.status === "COMPLETED" ? "PAID" : sale.status,
      provider: null,
      providerReference: null,
      simulated: false,
      items: sale.items.map((item) => ({ ...item, batches: [] })),
    });
    setPendingPayment(null);
    setCart([]);
    setDiscount("0");
    setDiscountType("none");
    setDiscountId("");
    setAmountReceived("0");
    setPaymentMethod("Cash");
    setIdempotencyKey(crypto.randomUUID());
  };

  const checkPendingPayment = async () => {
    if (!pendingPayment) return;
    try {
      const result = await api.paymentStatus(pendingPayment.paymentId);
      if (result.status === "PAID") await completeSale(pendingPayment.saleId);
      else if (["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(result.status)) {
        setPendingPayment(null);
        setIdempotencyKey(crypto.randomUUID());
        setSaleError(`Payment ${result.status.toLowerCase()}. The cart is unchanged and can be retried.`);
      } else setSaleError("Payment is still pending. Stock has not been changed.");
    } catch (error) { setSaleError(errorMessage(error)); }
  };

  const cancelPendingPayment = async () => {
    if (!pendingPayment) return;
    try {
      await api.cancelPayment(pendingPayment.paymentId);
      setPendingPayment(null);
      setIdempotencyKey(crypto.randomUUID());
      setSaleError("Payment cancelled. The cart is unchanged and can be retried.");
    } catch (error) { setSaleError(errorMessage(error)); }
  };

  const submitSale = async () => {
    if (!cart.length || pendingPayment) return;
    setSaleError("");
    if (discountType !== "none" && !discountId.trim()) {
      setSaleError(`${discountType === "pwd" ? "PWD" : "Senior citizen"} ID number is required for the 20% discount.`);
      return;
    }
    if (Number(amountReceived || 0) < total && paymentMethod === "Cash") {
      setSaleError("Cash amount must cover the total.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createSale({
        items: cart.map((item) => ({ medicineId: item.id, quantity: item.quantity })),
        discount: discountValue,
        discountType,
        discountId: discountId.trim(),
        paymentMethod,
        amountReceived: Number(amountReceived || total),
        idempotencyKey,
      });
      if (result.status === "PENDING") {
        if (!result.paymentId) throw new Error("Pending payment did not return a payment reference.");
        await onRefresh();
        setPendingPayment({ saleId: result.id, paymentId: result.paymentId });
        setSaleError("Payment is pending. Do not submit the order again; stock has not changed.");
        return;
      }
      await completeSale(result.id);
    } catch (error) {
      setSaleError(errorMessage(error));
      if (error instanceof ApiError && error.status === 402) setIdempotencyKey(crypto.randomUUID());
      void onRefresh().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <div className="receipt-print receipt-enter w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl" data-format={receiptFormat}>
          <div className="rounded-t-3xl bg-teal-600 px-6 py-5 text-center text-white">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-xl">✓</div>
            <div className="text-lg font-bold">Sale completed</div>
            <div className="text-xs text-teal-100">Your receipt is ready to print</div>
          </div>
          <div className="space-y-4 p-5">
            <div className="text-center text-sm text-slate-700"><div className="font-extrabold tracking-wide">Hopemed Pharmacy</div><div>Dollar street</div><div>North Fairview</div><div>Tel: (+63) 912-345-6789</div></div>
            <div className="border-y border-dashed border-slate-300 py-3 text-xs text-slate-600"><div className="flex justify-between"><span>Receipt No.:</span><span>{receipt.id}</span></div><div className="flex justify-between"><span>Date:</span><span>{new Date(receipt.transactionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div><div className="flex justify-between"><span>Cashier:</span><span>{receipt.cashierName}</span></div></div>
            <div className="text-xs text-slate-700"><div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-3 border-b border-slate-300 pb-2 font-bold"><span>Product</span><span>Qty</span><span>Price</span></div>{receipt.items.map((item) => <div key={item.medicineId} className="grid grid-cols-[1fr_auto_auto] gap-3 py-1"><span>{item.medicineName}</span><span>{item.quantity}</span><span>{fmt(item.subtotal)}</span></div>)}</div>
            <div className="border-y border-dashed border-slate-300 py-3 text-sm"><div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(receipt.subtotal)}</span></div><div className="flex justify-between text-slate-600"><span>Discount</span><span>{fmt(receipt.discount)}</span></div><div className="flex justify-between text-slate-600"><span>VAT</span><span>{fmt(receipt.tax)}</span></div><div className="mt-1 flex justify-between text-base font-extrabold text-slate-900"><span>TOTAL</span><span>{fmt(receipt.totalAmount)}</span></div></div>
            <div className="space-y-1 text-sm text-slate-600"><div>Payment: {receipt.paymentMethod}</div>{receipt.paymentMethod === "Cash" && <><div className="flex justify-between"><span>Cash Received:</span><span>{fmt(receipt.amountReceived)}</span></div><div className="flex justify-between"><span>Change:</span><span>{fmt(receipt.changeAmount)}</span></div></>}</div>
            <div className="text-center text-sm font-semibold text-slate-700">Thank you for shopping!</div>
            <div className="receipt-controls flex flex-wrap justify-between gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 p-1"><button aria-pressed={receiptFormat === "thermal"} onClick={() => setReceiptFormat("thermal")} className={`rounded px-2 py-1 text-xs ${receiptFormat === "thermal" ? "bg-teal-700 text-white" : "text-slate-600"}`}>Thermal</button><button aria-pressed={receiptFormat === "standard"} onClick={() => setReceiptFormat("standard")} className={`rounded px-2 py-1 text-xs ${receiptFormat === "standard" ? "bg-teal-700 text-white" : "text-slate-600"}`}>Standard</button></div>
              <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Print receipt</button>
              <button onClick={() => setReceipt(null)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">New transaction</button>
            </div>
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
            <input aria-label="Search medicines or scan barcode" value={search} onChange={(e) => { setSearch(e.target.value); setSearchPage(1); }} placeholder="Search medicines or scan barcode" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-teal-500" />
            <button onClick={() => { setScannerError(""); setScannerOpen(true); }} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Scan barcode</button>
          </div>
          {scannerOpen && <div className="mb-3 rounded-xl bg-slate-900 p-3"><video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-lg object-cover" /><button onClick={() => setScannerOpen(false)} className="mt-2 text-xs font-semibold text-white">Close scanner</button></div>}
          {scannerError && <div role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{scannerError}</div>}
          <div className="flex flex-wrap gap-2">
            {['All', 'Antibiotics', 'Analgesics', 'Cardiovascular', 'Diabetes', 'Antihistamine', 'Antacids', 'Vitamins', 'Respiratory', 'Dermatology'].map((filter) => (
              <button key={filter} onClick={() => setCategory(filter)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === filter ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {items.length === 0 ? <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{searchLoading ? "Searching medicines..." : searchError || (search ? "Medicine not found." : "No in-stock, unexpired medicines available.")}</div> : items.map((medicine) => (
            <button key={medicine.id} onClick={() => addToCart(medicine)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm hover:border-teal-300 hover:bg-white">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">{medicine.medicineType}</span>
                <span className="text-[10px] text-slate-500">{availableStock(medicine.id)} available</span>
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
        {searchError && items.length > 0 && <div role="alert" className="mx-4 mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{searchError}</div>}
        {remoteMedicines.length < searchTotal && <div className="px-4 pb-4 text-center"><button disabled={searchLoading} onClick={() => setSearchPage((page) => page + 1)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{searchLoading ? "Loading..." : `Load more (${searchTotal - remoteMedicines.length} remaining)`}</button></div>}
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
          {cartError && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{cartError}</div>}
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
              <label htmlFor="discount-type" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Discount</label>
              <select id="discount-type" value={discountType} onChange={(event) => { setDiscountType(event.target.value as "none" | "pwd" | "senior"); setDiscountId(""); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="none">None</option><option value="pwd">PWD - 20%</option><option value="senior">Senior citizen - 20%</option></select>
            </div>
          </div>
          {discountType !== "none" ? <div><label htmlFor="discount-id" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{discountType === "pwd" ? "PWD ID number" : "Senior citizen ID number"}</label><input id="discount-id" value={discountId} onChange={(event) => setDiscountId(event.target.value)} placeholder="Enter ID number" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /><div className="mt-1 text-[10px] text-slate-500">A 20% discount will apply automatically after the ID is entered.</div></div> : <div><label htmlFor="manual-discount" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Other discount</label><input id="manual-discount" type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></div>}
          {paymentMethod === 'Cash' && (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Tendered</label>
              <input value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}
          {paymentMethod !== "Cash" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Demo simulation only. No real payment is collected.</div>}
          {pendingPayment && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><div className="font-semibold">Payment pending confirmation</div><div className="mt-1">Stock remains unchanged. Check the provider status or cancel this attempt.</div><div className="mt-2 flex gap-3"><button onClick={() => void checkPendingPayment()} className="font-semibold underline">Check status</button><button onClick={() => void cancelPendingPayment()} className="font-semibold underline">Cancel attempt</button></div></div>}
          {saleError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{saleError}</div>}

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span>Tax</span><span>{fmt(taxValue)}</span></div>
            <div className="flex items-center justify-between"><span>Discount</span><span>-{fmt(discountValue)}</span></div>
            <div className="flex items-center justify-between text-base font-bold text-slate-900"><span>Total</span><span>{fmt(total)}</span></div>
            {paymentMethod === 'Cash' && <div className="flex items-center justify-between text-sm"><span>Change</span><span>{fmt(change)}</span></div>}
          </div>

          <button onClick={() => void submitSale()} disabled={submitting || cart.length === 0 || Boolean(pendingPayment)} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Processing..." : paymentMethod === "Cash" ? "Complete sale" : `Simulate ${paymentMethod} payment`}</button>
        </div>
      </div>
    </div>
  );
}

function InventoryPage({ state, onRefresh, lowStockOnly, expiringSoonOnly, onShowLowStock, onShowExpiringSoon, onClearFilters }: { state: PharmacyState; onRefresh: () => Promise<PharmacyState>; lowStockOnly: boolean; expiringSoonOnly: boolean; onShowLowStock: () => void; onShowExpiringSoon: () => void; onClearFilters: () => void }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "Add" | "Edit"; item?: Medicine } | null>(null);
  const [draft, setDraft] = useState<Partial<Medicine>>({});
  const [purchaseDraft, setPurchaseDraft] = useState({ supplierId: state.suppliers[0]?.id ?? "", medicineId: state.medicines[0]?.id ?? "", quantity: "1", unitCost: "0", batchNumber: "", expirationDate: "", referenceNumber: `PO-${Date.now()}` });
  const [movementDraft, setMovementDraft] = useState({ batchId: state.medicineBatches[0]?.id ?? "", movement: "ADJUSTMENT", quantity: "1", direction: "OUT" as "IN" | "OUT", notes: "" });
  const [operationError, setOperationError] = useState("");
  const [referenceMedicine, setReferenceMedicine] = useState<Awaited<ReturnType<typeof api.medicineDetail>> | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const filtered = state.medicines.filter((medicine) => {
    const q = search.toLowerCase();
    const matchesSearch = [medicine.brandName, medicine.genericName, medicine.barcode, medicine.batchNumber].some((field) => field.toLowerCase().includes(q));
    const matchesLowStock = !lowStockOnly || medicine.quantity <= medicine.reorderLevel;
    const matchesExpiringSoon = !expiringSoonOnly || isExpiringSoon(medicine.expirationDate);
    return matchesSearch && matchesLowStock && matchesExpiringSoon;
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

  const saveItem = async () => {
    if (!draft.brandName || !draft.genericName || !draft.barcode || (modal?.mode === "Add" && (!draft.batchNumber || !draft.expirationDate))) {
      window.alert("Please complete all required fields.");
      return;
    }

    if (modal?.mode === "Edit") {
      setConfirmDialog({ title: "Save medicine update?", message: `Are you sure you want to save changes to ${draft.brandName}?`, confirmLabel: "Save update", onConfirm: () => void performSave() });
      return;
    }

    await performSave();
  };

  const performSave = async () => {

    try {
      setOperationError("");
      await api.saveMedicine(modal?.mode === "Edit" ? modal.item?.id : undefined, {
        barcode: draft.barcode,
        genericName: draft.genericName,
        brandName: draft.brandName,
        medicineType: draft.medicineType,
        dosageForm: draft.dosageForm,
        strength: draft.strength,
        prescriptionRequired: Boolean(draft.prescriptionRequired),
        description: draft.description ?? "",
        dosageInformation: draft.dosageInformation ?? "",
        precautions: draft.precautions ?? "",
        contraindications: draft.contraindications ?? "",
        storageInformation: draft.storageInformation ?? "",
        supplierId: draft.supplierId || null,
        unitPrice: Number(draft.unitPrice ?? 0),
        reorderLevel: Number(draft.reorderLevel ?? 10),
        ...(modal?.mode === "Add" ? { quantity: Number(draft.quantity ?? 0), expirationDate: draft.expirationDate, batchNumber: draft.batchNumber } : {}),
      });
      await onRefresh();
      setModal(null);
      setDraft({});
    } catch (error) {
      setOperationError(error instanceof ApiError ? `${errorMessage(error)} (${error.status}${error.code ? ` · ${error.code}` : ""})` : errorMessage(error));
    }
  };

  const createPurchase = async () => {
    setOperationError("");
    try {
      await api.createPurchase({
        supplierId: purchaseDraft.supplierId,
        referenceNumber: purchaseDraft.referenceNumber,
        items: [{ medicineId: purchaseDraft.medicineId, quantity: Number(purchaseDraft.quantity), unitCost: Number(purchaseDraft.unitCost), batchNumber: purchaseDraft.batchNumber, expirationDate: purchaseDraft.expirationDate }],
      });
      await onRefresh();
      setPurchaseDraft((previous) => ({ ...previous, referenceNumber: `PO-${Date.now()}`, quantity: "1", batchNumber: "", expirationDate: "" }));
    } catch (error) { setOperationError(errorMessage(error)); }
  };

  const receivePurchase = async (purchaseId: string) => {
    setConfirmDialog({ title: "Receive purchase order?", message: "Are you sure you want to receive this purchase and add its stock?", confirmLabel: "Receive purchase", onConfirm: () => void performReceivePurchase(purchaseId) });
  };

  const performReceivePurchase = async (purchaseId: string) => {
    setOperationError("");
    try { await api.receivePurchase(purchaseId); await onRefresh(); }
    catch (error) { setOperationError(errorMessage(error)); }
  };

  const cancelPurchase = async (purchaseId: string) => {
    setConfirmDialog({ title: "Cancel purchase order?", message: "Are you sure you want to cancel this pending purchase order?", confirmLabel: "Cancel purchase", onConfirm: () => void performCancelPurchase(purchaseId) });
  };

  const performCancelPurchase = async (purchaseId: string) => {
    setOperationError("");
    try { await api.cancelPurchase(purchaseId); await onRefresh(); }
    catch (error) { setOperationError(errorMessage(error)); }
  };

  const recordMovement = async () => {
    setConfirmDialog({ title: "Record stock update?", message: "Are you sure you want to apply this stock movement?", confirmLabel: "Record update", onConfirm: () => void performRecordMovement() });
  };

  const performRecordMovement = async () => {
    setOperationError("");
    try {
      await api.recordInventoryMovement({ ...movementDraft, quantity: Number(movementDraft.quantity) });
      await onRefresh();
    } catch (error) { setOperationError(errorMessage(error)); }
  };

  const deleteItem = async (itemId: string) => {
    const medicine = state.medicines.find((item) => item.id === itemId);
    if (!medicine) return;
    setConfirmDialog({ title: "Delete medicine?", message: `Are you sure you want to archive ${medicine.brandName}? You can recover it from Backups later.`, confirmLabel: "Delete medicine", onConfirm: () => void performDelete(itemId) });
  };

  const performDelete = async (itemId: string) => {
    try { await api.archiveMedicine(itemId); await onRefresh(); }
    catch (error) { setOperationError(error instanceof ApiError ? `${errorMessage(error)} (${error.status}${error.code ? ` · ${error.code}` : ""})` : errorMessage(error)); }
  };

  const viewReference = async (id: string) => {
    setReferenceLoading(true);
    setOperationError("");
    try {
      const medicine = state.medicines.find((item) => item.id === id);
      if (!medicine) throw new Error("Medicine not found in the current inventory.");
      setReferenceMedicine({ ...medicine, batches: state.medicineBatches.filter((batch) => batch.medicineId === id), notice: "Medicine details are reference information only, not medical advice. Follow the product label and a licensed professional's guidance." });
    }
    catch (error) { setOperationError(errorMessage(error)); }
    finally { setReferenceLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">Inventory</div>
          <div className="text-sm text-slate-500">{state.medicines.length} medicine records tracked</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={lowStockOnly ? onClearFilters : onShowLowStock} className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${lowStockOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{lowStockOnly ? "Show all medicines" : "Show low stock"}</button>
          <button onClick={expiringSoonOnly ? onClearFilters : onShowExpiringSoon} className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${expiringSoonOnly ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{expiringSoonOnly ? "Show all medicines" : "Show expiring soon"}</button>
          <button onClick={openAdd} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-500">Add medicine</button>
        </div>
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
                      <button onClick={() => void viewReference(medicine.id)} className="text-xs font-semibold text-slate-600">Details</button>
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
      {operationError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{operationError}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Purchase receiving</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label htmlFor="purchase-supplier" className="mb-1 block text-xs font-semibold text-slate-600">Supplier</label><select id="purchase-supplier" value={purchaseDraft.supplierId} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, supplierId: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}</select></div>
            <div><label htmlFor="purchase-medicine" className="mb-1 block text-xs font-semibold text-slate-600">Medicine</label><select id="purchase-medicine" value={purchaseDraft.medicineId} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, medicineId: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{state.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.brandName}</option>)}</select></div>
            <Field label="Purchase reference" value={purchaseDraft.referenceNumber} onChange={(value) => setPurchaseDraft({ ...purchaseDraft, referenceNumber: value })} />
            <Field label="Batch number" value={purchaseDraft.batchNumber} onChange={(value) => setPurchaseDraft({ ...purchaseDraft, batchNumber: value })} />
            <Field label="Order quantity" type="number" value={purchaseDraft.quantity} onChange={(value) => setPurchaseDraft({ ...purchaseDraft, quantity: value })} />
            <Field label="Unit cost" type="number" value={purchaseDraft.unitCost} onChange={(value) => setPurchaseDraft({ ...purchaseDraft, unitCost: value })} />
            <Field label="Batch expiration" type="date" value={purchaseDraft.expirationDate} onChange={(value) => setPurchaseDraft({ ...purchaseDraft, expirationDate: value })} />
          </div>
          <button onClick={() => void createPurchase()} disabled={!state.suppliers.length || !state.medicines.length} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create purchase order</button>
          <div className="mt-5 divide-y divide-slate-100">
            {state.purchases.length === 0 ? <div className="py-3 text-sm text-slate-500">No purchase orders.</div> : state.purchases.map((purchase) => <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><div><div className="font-semibold text-slate-800">{purchase.referenceNumber} · {state.suppliers.find((supplier) => supplier.id === purchase.supplierId)?.supplierName ?? purchase.supplierId}</div><div className="mt-1 text-slate-500">{fmt(purchase.totalAmount)} · {purchase.status}</div></div>{purchase.status === "PENDING" && <div className="flex gap-3"><button onClick={() => void receivePurchase(purchase.id)} className="font-semibold text-teal-700">Receive</button><button onClick={() => void cancelPurchase(purchase.id)} className="font-semibold text-rose-700">Cancel</button></div>}</div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Stock movement</h2>
          <div className="space-y-3">
            <div><label htmlFor="movement-batch" className="mb-1 block text-xs font-semibold text-slate-600">Batch</label><select id="movement-batch" value={movementDraft.batchId} onChange={(event) => setMovementDraft({ ...movementDraft, batchId: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{state.medicineBatches.map((batch) => <option key={batch.id} value={batch.id}>{state.medicines.find((medicine) => medicine.id === batch.medicineId)?.brandName ?? batch.medicineId} · {batch.batchNumber} · {batch.expirationDate} · {batch.quantity} units</option>)}</select></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><label htmlFor="movement-type" className="mb-1 block text-xs font-semibold text-slate-600">Reason</label><select id="movement-type" value={movementDraft.movement} onChange={(event) => { const movement = event.target.value; setMovementDraft({ ...movementDraft, movement, direction: movement === "RETURN" ? "IN" : "OUT" }); }} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="ADJUSTMENT">Adjustment</option><option value="RETURN">Return</option><option value="DAMAGED">Damaged</option><option value="EXPIRED">Expired</option></select></div>
              <div><label htmlFor="movement-direction" className="mb-1 block text-xs font-semibold text-slate-600">Stock change</label><select id="movement-direction" value={movementDraft.direction} onChange={(event) => setMovementDraft({ ...movementDraft, direction: event.target.value as "IN" | "OUT" })} disabled={movementDraft.movement === "DAMAGED" || movementDraft.movement === "EXPIRED"} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="IN">Add to stock</option><option value="OUT">Remove from stock</option></select></div>
            </div>
            <Field label="Movement quantity" type="number" value={movementDraft.quantity} onChange={(value) => setMovementDraft({ ...movementDraft, quantity: value })} />
            <Field label="Notes" value={movementDraft.notes} onChange={(value) => setMovementDraft({ ...movementDraft, notes: value })} />
            <button onClick={() => void recordMovement()} disabled={!state.medicineBatches.length} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Record movement</button>
          </div>
          {operationError && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{operationError}</div>}
          <div className="mt-5 border-t border-slate-100 pt-3"><div className="mb-2 text-xs font-bold text-slate-700">Recent movements</div>{state.inventoryTransactions.slice(0, 6).map((movement) => <div key={movement.id} className="flex justify-between gap-2 border-b border-slate-50 py-2 text-[10px] text-slate-600"><span>{movement.transactionType} · {state.medicines.find((medicine) => medicine.id === movement.medicineId)?.brandName ?? movement.medicineId}</span><span>{movement.quantity > 0 ? "+" : ""}{movement.quantity} · {new Date(movement.timestamp).toLocaleDateString()}</span></div>)}</div>
        </section>
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
              {modal.mode === "Add" ? <Field label="Batch" value={draft.batchNumber ?? ""} onChange={(value) => setDraft({ ...draft, batchNumber: value })} /> : <div className="md:col-span-2 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-xs font-semibold text-slate-700">Stock batches</div><div className="space-y-1">{state.medicineBatches.filter((batch) => batch.medicineId === modal.item?.id).map((batch) => <div key={batch.id} className="flex justify-between gap-3 text-xs text-slate-600"><span>{batch.batchNumber} · expires {batch.expirationDate}</span><span className="font-semibold">{batch.quantity} units</span></div>)}</div><div className="mt-2 text-[10px] text-slate-500">Use receiving or stock adjustment to change batch stock.</div></div>}
              <Field label="Strength" value={draft.strength ?? ""} onChange={(value) => setDraft({ ...draft, strength: value })} />
              <Field label="Price" type="number" value={String(draft.unitPrice ?? 0)} onChange={(value) => setDraft({ ...draft, unitPrice: Number(value) })} />
              {modal.mode === "Add" && <Field label="Initial quantity" type="number" value={String(draft.quantity ?? 0)} onChange={(value) => setDraft({ ...draft, quantity: Number(value) })} />}
              <Field label="Reorder level" type="number" value={String(draft.reorderLevel ?? 10)} onChange={(value) => setDraft({ ...draft, reorderLevel: Number(value) })} />
              {modal.mode === "Add" && <Field label="Expiration date" type="date" value={draft.expirationDate ?? "2027-01-01"} onChange={(value) => setDraft({ ...draft, expirationDate: value })} />}
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
      {referenceLoading && <div role="status" className="rounded-lg bg-white p-3 text-sm text-slate-500">Loading medicine reference...</div>}
      {referenceMedicine && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><h2 className="text-lg font-bold text-slate-900">{referenceMedicine.brandName}</h2><p className="mt-1 text-xs text-slate-500">{referenceMedicine.genericName} · {referenceMedicine.strength}</p></div><button aria-label="Close medicine reference" onClick={() => setReferenceMedicine(null)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600">Close</button></header><div className="space-y-4 p-5"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{referenceMedicine.notice}</div><p className="text-sm text-slate-700">{referenceMedicine.description || "No description provided."}</p><div className="grid gap-3 sm:grid-cols-2">{[["Dosage information",referenceMedicine.dosageInformation],["Precautions",referenceMedicine.precautions],["Contraindications",referenceMedicine.contraindications],["Storage",referenceMedicine.storageInformation]].map(([label,value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-700">{label}</div><div className="mt-1 text-xs text-slate-600">{value || "Not specified."}</div></div>)}</div><div className="border-t border-slate-100 pt-3"><div className="mb-2 text-xs font-bold text-slate-700">Batch stock</div>{referenceMedicine.batches.map((batch) => <div key={batch.id} className="flex justify-between gap-3 py-1 text-xs text-slate-600"><span>{batch.batchNumber} · expires {batch.expirationDate}</span><span>{batch.quantity} units</span></div>)}</div></div></section></div>}
      {confirmDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h2><p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirmDialog(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button onClick={() => { const confirm = confirmDialog.onConfirm; setConfirmDialog(null); confirm(); }} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">{confirmDialog.confirmLabel}</button></div></div></div>}
    </div>
  );
}

type ConfirmDialogData = { title: string; message: string; confirmLabel: string; onConfirm: () => void };

function ConfirmDialog({ dialog, onClose }: { dialog: ConfirmDialogData | null; onClose: () => void }) {
  if (!dialog) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold text-slate-900">{dialog.title}</h2><p className="mt-2 text-sm text-slate-600">{dialog.message}</p><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button onClick={() => { onClose(); dialog.onConfirm(); }} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">{dialog.confirmLabel}</button></div></div></div>;
}

function SuppliersPage({ state, onRefresh }: { state: PharmacyState; onRefresh: () => Promise<PharmacyState> }) {
  const [draft, setDraft] = useState<Partial<Supplier>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogData | null>(null);

  const save = async () => {
    if (!draft.supplierName || !draft.phone) {
      window.alert("Supplier name and phone are required.");
      return;
    }

    setConfirmDialog({ title: editingId ? "Save supplier update?" : "Save supplier?", message: `Are you sure you want to ${editingId ? "save these changes to" : "create"} ${draft.supplierName}?`, confirmLabel: editingId ? "Save update" : "Save supplier", onConfirm: () => void performSave() });
  };

  const performSave = async () => {
    try {
      await api.saveSupplier(editingId ?? undefined, draft);
      await onRefresh();
      setDraft({});
      setEditingId(null);
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const remove = async (id: string) => {
    const supplier = state.suppliers.find((item) => item.id === id);
    if (!supplier) return;
    setConfirmDialog({ title: "Delete supplier?", message: `Are you sure you want to deactivate ${supplier.supplierName}?`, confirmLabel: "Delete supplier", onConfirm: () => void performRemove(id) });
  };

  const performRemove = async (id: string) => {
    try { await api.archiveSupplier(id); await onRefresh(); }
    catch (error) { window.alert(errorMessage(error)); }
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
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

function UsersPage({ state, onRefresh, currentUser }: { state: PharmacyState; onRefresh: () => Promise<PharmacyState>; currentUser: PharmacyUser }) {
  const [draft, setDraft] = useState<Partial<PharmacyUser & { password: string }>>({ password: "" });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogData | null>(null);

  const save = async () => {
    if (!draft.fullName || !draft.email || (!editingUserId && !draft.username)) {
      window.alert("Username, full name and email are required.");
      return;
    }
    if (!editingUserId && String(draft.password ?? "").length < 10) {
      window.alert("Use a password with at least 10 characters.");
      return;
    }
    setConfirmDialog({ title: editingUserId ? "Save user update?" : "Create user?", message: `Are you sure you want to ${editingUserId ? "save these changes to" : "create"} ${draft.fullName}?`, confirmLabel: editingUserId ? "Save update" : "Create user", onConfirm: () => void performSave() });
  };

  const performSave = async () => {
    try {
      if (editingUserId) await api.updateUser(editingUserId, { fullName: draft.fullName!, email: draft.email!, role: draft.role ?? "CASHIER" });
      else await api.createUser({ username: String(draft.username), fullName: String(draft.fullName), email: String(draft.email), password: String(draft.password), role: draft.role ?? "CASHIER" });
      await onRefresh();
      setDraft({ password: "" });
      setEditingUserId(null);
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const deactivate = async (user: PharmacyUser) => {
    if (user.id === currentUser.id) return;
    setConfirmDialog({ title: "Delete user?", message: `Are you sure you want to deactivate ${user.fullName}? Their active sessions will be closed.`, confirmLabel: "Delete user", onConfirm: () => void performDeactivate(user) });
  };

  const performDeactivate = async (user: PharmacyUser) => {
    try { await api.deactivateUser(user.id); await onRefresh(); }
    catch (error) { window.alert(errorMessage(error)); }
  };

  const submitPasswordReset = async () => {
    if (!resetUserId || resetPassword.length < 10) { window.alert("Use a password with at least 10 characters."); return; }
    const user = state.users.find((item) => item.id === resetUserId);
    if (!user) return;
    setConfirmDialog({ title: "Reset password?", message: `Are you sure you want to reset the password for ${user.fullName}?`, confirmLabel: "Reset password", onConfirm: () => void performPasswordReset() });
  };

  const performPasswordReset = async () => {
    if (!resetUserId) return;
    try { await api.resetUserPassword(resetUserId, resetPassword); await onRefresh(); setResetPassword(""); setResetUserId(null); }
    catch (error) { window.alert(errorMessage(error)); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 text-lg font-bold text-slate-900">{editingUserId ? "Edit user" : "Create user"}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {!editingUserId && <Field label="Username" value={draft.username ?? ""} onChange={(value) => setDraft({ ...draft, username: value })} />}
          <Field label="Full name" value={draft.fullName ?? ""} onChange={(value) => setDraft({ ...draft, fullName: value })} />
          <Field label="Email" value={draft.email ?? ""} onChange={(value) => setDraft({ ...draft, email: value })} />
          {!editingUserId && <Field label="Password" type="password" value={draft.password ?? ""} onChange={(value) => setDraft({ ...draft, password: value })} />}
          <div>
            <label htmlFor="user-role" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Role</label>
            <select id="user-role" value={draft.role ?? "CASHIER"} disabled={editingUserId === currentUser.id} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm disabled:opacity-60">
              {['ADMIN', 'PHARMACIST', 'CASHIER'].map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          {editingUserId && <button onClick={() => { setEditingUserId(null); setDraft({ password: "" }); }} className="mr-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>}
          <button onClick={save} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500">{editingUserId ? "Save user" : "Create account"}</button>
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
              <div className="flex flex-wrap items-center gap-3">
                {user.status === "ACTIVE" && <>
                  <button onClick={() => { setEditingUserId(user.id); setDraft({ fullName: user.fullName, email: user.email, role: user.role, username: user.username, password: "" }); }} className="text-xs font-semibold text-teal-700">Edit</button>
                  <button onClick={() => void deactivate(user)} disabled={user.id === currentUser.id} className="text-xs font-semibold text-rose-700 disabled:opacity-40">Deactivate</button>
                  <button onClick={() => { setResetUserId(resetUserId === user.id ? null : user.id); setResetPassword(""); }} disabled={user.id === currentUser.id} className="text-xs font-semibold text-slate-700 disabled:opacity-40">Reset password</button>
                </>}
                <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">{user.status}</div>
              </div>
              {resetUserId === user.id && <div className="mt-3 flex flex-wrap gap-2"><input type="password" autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} aria-label={`New password for ${user.fullName}`} placeholder="New password (10+ characters)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" /><button onClick={() => void submitPasswordReset()} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Save password</button><button onClick={() => { setResetUserId(null); setResetPassword(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button></div>}
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ actor: "", action: "", entityType: "", search: "" });
  const [applied, setApplied] = useState(filters);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.audit({ page, pageSize: 25, ...applied }).then((result) => {
      if (!active) return;
      setLogs(result.logs);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, applied]);

  const applyFilters = () => { setPage(1); setApplied({ ...filters }); };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-end md:justify-between">
        <div><div className="text-sm font-bold text-slate-900">Audit trail</div><div className="mt-1 text-xs text-slate-500">{total.toLocaleString()} recorded events</div></div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input aria-label="Filter audit by person" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })} placeholder="Person or username" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          <input aria-label="Filter audit by action" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} placeholder="Action" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          <input aria-label="Filter audit by record type" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })} placeholder="Record type" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          <div className="flex gap-2"><input aria-label="Search audit details" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search details" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" /><button onClick={applyFilters} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Apply</button></div>
        </div>
      </div>
      {error && <div role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error} <button onClick={() => applyFilters()} className="ml-2 font-semibold underline">Retry</button></div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && logs.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No audit events match these filters.</td></tr>}
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Loading audit events...</td></tr>}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">{log.actorName ?? (typeof log.metadata.username === "string" ? log.metadata.username : "System")}</div>
                  {log.actorUsername && <div className="text-xs text-slate-500">@{log.actorUsername}</div>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div className="font-medium">{log.entityName ?? log.entityId}</div>
                  <div>{log.entityType} · {log.entityId}</div>
                </td>
                <td className="max-w-sm px-4 py-3 text-xs text-slate-600">
                  <details>
                    <summary className="cursor-pointer font-semibold text-teal-700">View details</summary>
                    <pre className="mt-2 max-w-sm whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-[10px]">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </details>
                </td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{log.success ? 'Success' : 'Failure'}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </div>
  );
}

function BackupsPage() {
  const [backups, setBackups] = useState<import("./api").BackupRecord[]>([]);
  const [archivedMedicines, setArchivedMedicines] = useState<Medicine[]>([]);
  const [changes, setChanges] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([api.backups(), api.archivedMedicines(), api.backupChanges()]).then(([backupResult, archivedResult, changeResult]) => { if (active) { setBackups(backupResult.backups); setArchivedMedicines(archivedResult.medicines); setChanges(changeResult.logs); } }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const createBackup = async () => {
    setCreating(true);
    setError("");
    try { await api.createBackup(); setReloadKey((key) => key + 1); }
    catch (reason) { setError(errorMessage(reason)); setReloadKey((key) => key + 1); }
    finally { setCreating(false); }
  };

  const restoreMedicine = async (medicine: Medicine) => {
    setConfirmDialog({ title: "Restore medicine?", message: `Are you sure you want to restore ${medicine.brandName} to active inventory?`, confirmLabel: "Restore medicine", onConfirm: () => void performRestoreMedicine(medicine) });
  };

  const performRestoreMedicine = async (medicine: Medicine) => {
    setError("");
    try { await api.restoreMedicine(medicine.id); setReloadKey((key) => key + 1); }
    catch (reason) { setError(errorMessage(reason)); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="text-sm font-bold text-slate-900">Database backups</h2><p className="mt-1 text-xs text-slate-500">{backups.length} recent backup records</p></div><button onClick={() => void createBackup()} disabled={creating} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{creating ? "Creating backup..." : "Create backup"}</button></div>
      {error && <div role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      <div className="divide-y divide-slate-100">
        {loading && <div className="p-4 text-sm text-slate-500">Loading backup history...</div>}
        {!loading && backups.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No backups have been requested.</div>}
        {backups.map((backup) => <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="text-sm font-semibold text-slate-800">{backup.fileName ?? backup.id}</div><div className="mt-1 text-xs text-slate-500">Requested by {backup.requestedBy ?? "Unknown"} · {new Date(backup.requestedAt).toLocaleString()}</div>{backup.errorMessage && <div className="mt-1 text-xs text-rose-700">{backup.errorMessage}</div>}</div><div className="flex items-center gap-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${backup.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : backup.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{backup.status}</span>{backup.fileSizeBytes != null && <span className="text-xs text-slate-500">{(backup.fileSizeBytes / 1048576).toFixed(2)} MB</span>}{backup.status === "COMPLETED" && <a href={`/api/backups/${encodeURIComponent(backup.id)}/download`} className="text-xs font-semibold text-teal-700">Download</a>}</div></div>)}
      </div>
      <section className="border-t border-slate-100 p-4">
        <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">Deleted medicines</h3><p className="mt-1 text-xs text-slate-500">Archived medicines can be recovered here.</p></div>
        {archivedMedicines.length === 0 ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No deleted medicines.</div> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Barcode</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Deleted/updated</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-slate-100">{archivedMedicines.map((medicine) => <tr key={medicine.id}><td className="px-3 py-2"><div className="font-semibold text-slate-800">{medicine.brandName}</div><div className="text-slate-500">{medicine.genericName}</div></td><td className="px-3 py-2 text-slate-600">{medicine.barcode}</td><td className="px-3 py-2 text-slate-600">{medicine.quantity}</td><td className="px-3 py-2 text-slate-500">{new Date(medicine.updatedAt).toLocaleString()}</td><td className="px-3 py-2 text-right"><button onClick={() => void restoreMedicine(medicine)} className="font-semibold text-teal-700">Restore</button></td></tr>)}</tbody></table></div>}
      </section>
      <section className="border-t border-slate-100 p-4">
        <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">All record changes</h3><p className="mt-1 text-xs text-slate-500">Created, edited, deleted, restored, and account changes.</p></div>
        {changes.length === 0 ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No record changes yet.</div> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Action</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">By</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{changes.map((change) => <tr key={change.id}><td className="px-3 py-2 font-semibold text-slate-800">{change.action}</td><td className="px-3 py-2 text-slate-600">{change.entityName ?? change.entityId}<div className="text-[10px] text-slate-400">{change.entityType}</div></td><td className="px-3 py-2 text-slate-600">{change.actorName ?? change.actorUsername ?? "System"}</td><td className="px-3 py-2 text-slate-500">{new Date(change.timestamp).toLocaleString()}</td><td className="max-w-xs px-3 py-2"><details><summary className="cursor-pointer font-semibold text-teal-700">View</summary><pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-slate-500">{JSON.stringify(change.metadata, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}
      </section>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </section>
  );
}

function ReportsPage({ state }: { state: PharmacyState }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(() => ({ from: `${today().slice(0, 4)}-01-01`, to: today() }));
  const [applied, setApplied] = useState(filters);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.reports(applied).then((result) => { if (active) setReport(result); }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);

  const sales = state.sales.filter((sale) => sale.status === "COMPLETED");
  const totalRevenue = report?.summary.totalRevenue ?? 0;
  const inventoryValue = report?.inventory.value ?? 0;
  const totalUnits = report?.summary.totalUnits ?? 0;
  const lowStock = report?.inventory.low_stock_count ?? 0;
  const monthlyRevenue = (report?.monthly ?? []).map((entry) => ({ month: new Date(`${entry.month}-01T12:00:00`).toLocaleString("en", { month: "short" }), revenue: entry.revenue }));
  const byPayment = report?.payment ?? [];
  const byCategory = report?.category ?? [];
  const topSelling = report?.topSelling ?? [];
  const movement = (report?.movement ?? []).map((entry) => ({ ...entry, month: new Date(`${entry.month}-01T12:00:00`).toLocaleString("en", { month: "short" }) }));

  const download = (name: string, rows: string[][]) => {
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSales = () => {
    const filteredSales = sales.filter((sale) => {
      const date = dateKey(sale.transactionDate);
      return date >= applied.from && date <= applied.to;
    });
    download(`sales-${applied.from}-${applied.to}.csv`, [
      ["Transaction", "Date", "Cashier", "Payment", "Subtotal", "Discount", "VAT", "Total", "Items"],
      ...filteredSales.map((sale) => [sale.id, sale.transactionDate, sale.cashierName, sale.paymentMethod, String(sale.subtotal), String(sale.discount), String(sale.tax), String(sale.totalAmount), sale.items.map((item) => `${item.medicineName} x ${item.quantity}`).join("; ")]),
    ]);
  };
  const revenueByPayment = byPayment.length > 0 ? byPayment : Object.entries(sales.reduce<Record<string, number>>((totals, sale) => ({ ...totals, [sale.paymentMethod]: (totals[sale.paymentMethod] ?? 0) + sale.totalAmount }), {})).map(([name, value]) => ({ name, value }));
  const exportInventory = () => download("inventory-report.csv", [["Medicine", "Barcode", "Stock", "Reorder level", "Unit price", "Expiration"], ...state.medicines.map((medicine) => [medicine.brandName, medicine.barcode, String(medicine.quantity), String(medicine.reorderLevel), String(medicine.unitPrice), medicine.expirationDate])]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div><div className="text-2xl font-bold text-slate-900">Reports &amp; Analytics</div><div className="text-xs text-slate-500">Revenue, inventory movement, and sales performance</div></div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From date" type="date" value={filters.from} onChange={(from) => setFilters({ ...filters, from })} />
          <Field label="To date" type="date" value={filters.to} onChange={(to) => setFilters({ ...filters, to })} />
          <button onClick={() => setApplied({ ...filters })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Apply dates</button>
          <button onClick={() => exportSales()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600">Export sales</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error} <button onClick={() => setApplied({ ...applied })} className="ml-2 font-semibold underline">Retry</button></div>}
      {loading && <div className="rounded-lg bg-white p-3 text-sm text-slate-500">Loading reports...</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ReportMetric label="Revenue in range" value={fmt(totalRevenue)} note={`${report?.summary.transactions ?? 0} completed transactions`} color="text-teal-700" />
        <ReportMetric label="Total Transactions" value={(report?.summary.transactions ?? 0).toLocaleString()} note="Completed sales" color="text-slate-900" />
        <ReportMetric label="Medicines Dispensed" value={totalUnits.toLocaleString()} note="Units recorded on sales" color="text-slate-900" />
        <ReportMetric label="Average Basket Size" value={fmt(report?.summary.averageBasket ?? 0)} note="Per completed transaction" color="text-teal-700" />
        <ReportMetric label="Inventory Value" value={fmt(inventoryValue)} note={`${lowStock} low stock · ${report?.inventory.expiring_soon_count ?? 0} expiring soon`} color="text-slate-900" />
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><div className="text-sm font-bold text-slate-900">Generate Reports</div><div className="text-xs text-slate-500">Download structured reports for inventory and business monitoring</div></div><div className="grid gap-3 md:grid-cols-2"><ReportDownload title="Monthly Inventory Report" format="CSV" description="Stock levels, reorder points, and expiration dates" onClick={exportInventory} /><ReportDownload title="Sales Transaction Log" format="CSV" description="Completed transactions and payment details" onClick={exportSales} /><ReportDownload title="Revenue Summary" format="CSV" description="Revenue totals by payment method" onClick={() => download("revenue-summary.csv", [["Payment method", "Revenue"], ...revenueByPayment.map((entry) => [entry.name, String(entry.value)])])} /><ReportDownload title="Low Stock Alert Report" format="CSV" description="Items below their configured reorder level" onClick={() => download("low-stock-report.csv", [["Medicine", "Current stock", "Reorder level"], ...state.medicines.filter((medicine) => medicine.quantity <= medicine.reorderLevel).map((medicine) => [medicine.brandName, String(medicine.quantity), String(medicine.reorderLevel)])])} /></div></div>
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

function BrandMark({ large = false, className = "" }: { large?: boolean; className?: string }) {
  const sizeClass = large ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10";
  return <img src={appLogo} alt="Pharmasync logo" className={`object-contain ${sizeClass} ${className}`} />;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label htmlFor={`field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</label>
      <input id={`field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
    </div>
  );
}

function StatCard({ title, value, sub, icon, accent, onClick }: { title: string; value: string; sub: string; icon: React.ReactNode; accent: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:border-teal-500">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
      </div>
    </button>
  );
}

export default App;
