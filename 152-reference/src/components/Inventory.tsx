import { useState } from "react";
import { Product, CATEGORIES, fmt } from "../data";

type SortKey = "name" | "stock" | "price" | "expiry";

const BLANK: Omit<Product, "id"> = { name: "", genericName: "", category: "Antibiotics", price: 0, stock: 0, unit: "tablet", batch: "", expiry: "", reorderLevel: 20, supplier: "" };

function StockBar({ stock, reorder }: { stock: number; reorder: number }) {
  const max = Math.max(reorder * 4, stock, 1);
  const pct = Math.min(100, (stock / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold ${stock === 0 ? "text-red-600" : stock <= reorder ? "text-amber-600" : "text-gray-800"}`}>{stock}</span>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${stock === 0 ? "bg-red-400" : stock <= reorder ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Inventory({ products, setProducts }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>> }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(BLANK);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered = products
    .filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (stockFilter === "low" && (p.stock === 0 || p.stock > p.reorderLevel)) return false;
      if (stockFilter === "out" && p.stock > 0) return false;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.genericName.toLowerCase().includes(q) || p.batch.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let v = 0;
      if (sortKey === "name") v = a.name.localeCompare(b.name);
      else if (sortKey === "stock") v = a.stock - b.stock;
      else if (sortKey === "price") v = a.price - b.price;
      else if (sortKey === "expiry") v = a.expiry.localeCompare(b.expiry);
      return sortAsc ? v : -v;
    });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className={`ml-1 ${sortKey === k ? "text-teal-600" : "text-gray-300"}`}>{sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}</span>
  );

  const openAdd = () => { setForm(BLANK); setEditing(null); setModal("add"); };
  const openEdit = (p: Product) => { setForm({ name: p.name, genericName: p.genericName, category: p.category, price: p.price, stock: p.stock, unit: p.unit, batch: p.batch, expiry: p.expiry, reorderLevel: p.reorderLevel, supplier: p.supplier }); setEditing(p); setModal("edit"); };

  const save = () => {
    if (!form.name.trim() || !form.batch.trim() || !form.expiry) return;
    if (modal === "edit" && editing) {
      setProducts((prev) => prev.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p));
    } else {
      setProducts((prev) => [...prev, { ...form, id: Date.now() }]);
    }
    setModal(null);
  };

  const del = (id: number) => { setProducts((prev) => prev.filter((p) => p.id !== id)); setDeleteConfirm(null); };

  const statusBadge = (p: Product) => {
    const daysLeft = Math.floor((new Date(p.expiry).getTime() - new Date("2026-09-10").getTime()) / 86400000);
    if (p.stock === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Out</span>;
    if (p.stock <= p.reorderLevel) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low</span>;
    if (daysLeft <= 90) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Expiring</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>;
  };

  const f = (key: keyof Omit<Product, "id">, val: string | number) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">{products.length} products · {products.filter(p => p.stock > 0).length} in stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm hover:shadow-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, generic, batch, supplier..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
          {(["all", "low", "out"] as const).map((f) => (
            <button key={f} onClick={() => setStockFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${stockFilter === f ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("name")} className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 flex items-center">
                    Product <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("price")} className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 flex items-center">
                    Price <SortIcon k="price" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("stock")} className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 flex items-center">
                    Stock <SortIcon k="stock" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("expiry")} className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 flex items-center">
                    Expiry <SortIcon k="expiry" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const daysLeft = Math.floor((new Date(p.expiry).getTime() - new Date("2026-09-10").getTime()) / 86400000);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.genericName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(p.price)}</td>
                    <td className="px-4 py-3">
                      <StockBar stock={p.stock} reorder={p.reorderLevel} />
                      <p className="text-[10px] text-gray-400 mt-0.5">min {p.reorderLevel} {p.unit}s</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.batch}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${daysLeft <= 90 ? "text-orange-600 font-semibold" : "text-gray-500"}`}>{p.expiry}</span>
                      {daysLeft <= 90 && <p className="text-[10px] text-orange-400">{daysLeft}d left</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.supplier}</td>
                    <td className="px-4 py-3">{statusBadge(p)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} className="text-xs text-teal-600 hover:text-teal-800 font-semibold">Edit</button>
                        <button onClick={() => setDeleteConfirm(p.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300 text-sm">No products match your filters</div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 bg-gray-50">
          Showing {filtered.length} of {products.length} products
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{modal === "add" ? "Add New Product" : "Edit Product"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { label: "Brand Name *", key: "name" as const, type: "text", col: 2 },
                { label: "Generic Name *", key: "genericName" as const, type: "text", col: 2 },
                { label: "Price per Unit (₱) *", key: "price" as const, type: "number", col: 1 },
                { label: "Stock Quantity *", key: "stock" as const, type: "number", col: 1 },
                { label: "Reorder Level", key: "reorderLevel" as const, type: "number", col: 1 },
                { label: "Batch Number *", key: "batch" as const, type: "text", col: 1 },
                { label: "Expiry Date *", key: "expiry" as const, type: "date", col: 1 },
                { label: "Supplier", key: "supplier" as const, type: "text", col: 1 },
              ].map((field) => (
                <div key={field.key} className={field.col === 2 ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">{field.label}</label>
                  <input type={field.type} value={(form as any)[field.key]}
                    onChange={(e) => f(field.key, field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => f("category", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
                  {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Unit</label>
                <select value={form.unit} onChange={(e) => f("unit", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
                  {["tablet", "capsule", "inhaler", "bottle", "vial", "sachet", "tube", "ampule"].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={save} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                {modal === "add" ? "Add Product" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-600"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd"/></svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Delete Product?</h3>
            <p className="text-sm text-gray-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button onClick={() => del(deleteConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
