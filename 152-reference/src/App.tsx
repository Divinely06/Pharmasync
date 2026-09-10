import { useState } from "react";
import { Product, SaleRecord, PRODUCTS, SALES, fmt } from "./data";
import Dashboard from "./components/Dashboard";
import POS from "./components/POS";
import Inventory from "./components/Inventory";
import Reports from "./components/Reports";

type Page = "dashboard" | "pos" | "inventory" | "reports";

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
        <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
        <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
      </svg>
    ),
  },
  {
    id: "pos",
    label: "Point of Sale",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
        <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
      </svg>
    ),
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
        <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" />
        <path fillRule="evenodd" d="m3.087 9 .54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087Zm6.163 3.75A.75.75 0 0 1 10 12h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
        <path fillRule="evenodd" d="M2.25 2.25a.75.75 0 0 0 0 1.5H3v10.5a3 3 0 0 0 3 3h1.21l-1.172 3.513a.75.75 0 0 0 1.424.474l.329-.987h8.418l.33.987a.75.75 0 0 0 1.422-.474l-1.17-3.513H18a3 3 0 0 0 3-3V3.75h.75a.75.75 0 0 0 0-1.5H2.25Zm6.54 15h6.42l.5 1.5H8.29l.5-1.5Zm8.085-8.995a.75.75 0 1 0-.75-1.299 12.81 12.81 0 0 0-3.558 3.05L11.03 8.47a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l2.47-2.47 1.617 1.618a.75.75 0 0 0 1.146-.102 11.312 11.312 0 0 1 3.612-3.321Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [sales, setSales] = useState<SaleRecord[]>(SALES);
  const [mobileOpen, setMobileOpen] = useState(false);

  const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;

  const handleSale = (sale: SaleRecord, soldItems: { id: number; qty: number }[]) => {
    setSales((prev) => [...prev, sale]);
    setProducts((prev) =>
      prev.map((p) => {
        const item = soldItems.find((i) => i.id === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
      })
    );
  };

  const todayRevenue = sales
    .filter((s) => s.date === "2026-09-10" && s.status === "completed")
    .reduce((a, s) => a + s.total, 0);

  return (
    <div className="flex h-full bg-[#f8fafc]" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}`}
        style={{ minWidth: "240px" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight">PharmaSync</p>
              <p className="text-[10px] text-gray-400 truncate">HopeMed Pharmacy</p>
            </div>
          </div>
        </div>

        {/* Today's snapshot */}
        <div className="mx-3 mt-4 mb-1 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-4 text-white">
          <p className="text-[10px] font-semibold opacity-70 mb-1 uppercase tracking-wider">Today's Revenue</p>
          <p className="text-xl font-bold">{fmt(todayRevenue)}</p>
          <p className="text-[10px] opacity-60 mt-0.5">Sep 10, 2026</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-3 py-2">Main Menu</p>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => { setPage(n.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${page === n.id ? "bg-teal-50 text-teal-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
            >
              <span className={page === n.id ? "text-teal-600" : ""}>{n.icon}</span>
              {n.label}
              {n.id === "inventory" && lowStockCount > 0 && (
                <span className="ml-auto text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{lowStockCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-teal-700 text-xs font-bold">MS</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">Maria Santos</p>
              <p className="text-[10px] text-gray-400">Cashier · Active</p>
            </div>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="text-gray-500 hover:text-gray-800 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/></svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">PharmaSync</span>
          </div>
          <div className="w-5" />
        </header>

        {/* Page Content */}
        <main className={`flex-1 overflow-hidden ${page === "pos" ? "flex flex-col" : "overflow-auto"}`}>
          {page === "dashboard" && <Dashboard products={products} sales={sales} />}
          {page === "pos" && (
            <div className="flex-1 overflow-hidden flex">
              <POS products={products} onSale={handleSale} />
            </div>
          )}
          {page === "inventory" && <Inventory products={products} setProducts={setProducts} />}
          {page === "reports" && <Reports sales={sales} products={products} />}
        </main>
      </div>
    </div>
  );
}
