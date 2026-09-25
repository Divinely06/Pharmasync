import { useState } from "react";
import { Product, CartItem, SaleRecord, fmt, CATEGORIES } from "../data";

function ReceiptView({ sale, onNew }: { sale: SaleRecord; onNew: () => void }) {
  return (
    <div className="flex items-center justify-center flex-1 bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm overflow-hidden">
        <div className="bg-teal-600 px-6 py-5 text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd"/></svg>
          </div>
          <h2 className="text-white font-bold text-lg">Payment Confirmed</h2>
          <p className="text-teal-200 text-sm mt-0.5">{sale.id}</p>
        </div>
        <div className="p-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
            {sale.items.map((i) => (
              <div key={i.name} className="flex justify-between">
                <span className="text-gray-600 flex-1 mr-2 truncate">{i.name} <span className="text-gray-400">×{i.qty}</span></span>
                <span className="font-medium text-gray-800 flex-shrink-0">{fmt(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Subtotal</span><span>{fmt(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span>Discount</span><span>-{fmt(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900">
                <span>TOTAL</span><span>{fmt(sale.total)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-5">
            <span>Payment: <strong className="text-gray-700">{sale.payment}</strong></span>
            <span>{sale.date} {sale.time}</span>
          </div>
          <button onClick={onNew} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
            New Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POS({ products, onSale }: { products: Product[]; onSale: (s: SaleRecord, soldItems: { id: number; qty: number }[]) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [payment, setPayment] = useState("Cash");
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("");
  const [receipt, setReceipt] = useState<SaleRecord | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = products.filter((p) => {
    const mc = category === "All" || p.category === category;
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.genericName.toLowerCase().includes(search.toLowerCase());
    return mc && ms && p.stock > 0;
  });

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) return prev;
        return prev.map((c) => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const setQty = (id: number, qty: number) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const clamped = Math.max(1, Math.min(qty, prod.stock));
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: clamped } : c));
  };

  const remove = (id: number) => setCart((prev) => prev.filter((c) => c.id !== id));

  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discountAmt = parseFloat(discount || "0");
  const total = Math.max(0, subtotal - discountAmt);
  const change = parseFloat(tendered || "0") - total;

  const canCheckout = cart.length > 0 && (payment !== "Cash" || parseFloat(tendered || "0") >= total);

  const checkout = () => {
    if (!canCheckout) return;
    const now = new Date();
    const sale: SaleRecord = {
      id: `TXN-${Date.now().toString().slice(-4)}`,
      date: "2026-09-10",
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      subtotal,
      discount: discountAmt,
      total,
      payment,
      cashier: "Maria Santos",
      status: "completed",
    };
    onSale(sale, cart.map((c) => ({ id: c.id, qty: c.qty })));
    setReceipt(sale);
    setCart([]);
    setTendered("");
    setDiscount("");
  };

  if (receipt) {
    return <ReceiptView sale={receipt} onNew={() => setReceipt(null)} />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Product Browser */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
        {/* Search & Filters */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or generic..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 text-xs transition-colors ${view === "grid" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3V6ZM3 15.75a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.25Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3v-2.25Z" clipRule="evenodd"/></svg>
              </button>
              <button onClick={() => setView("list")} className={`px-3 py-2 text-xs transition-colors ${view === "list" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const inCart = cart.find((c) => c.id === p.id);
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className={`text-left bg-white rounded-xl border p-4 hover:shadow-md hover:border-teal-300 transition-all group relative ${inCart ? "border-teal-400 ring-1 ring-teal-400/40 shadow-sm" : "border-gray-100 shadow-sm"}`}>
                    {inCart && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{inCart.qty}</span>
                    )}
                    <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full inline-block mb-2">{p.category}</span>
                    <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">{p.name}</p>
                    <p className="text-[10px] text-gray-400 mb-3">{p.genericName}</p>
                    <div className="flex items-end justify-between">
                      <span className="text-base font-bold text-teal-700">{fmt(p.price)}</span>
                      <span className={`text-[10px] font-medium ${p.stock <= p.reorderLevel ? "text-amber-500" : "text-gray-300"}`}>{p.stock} left</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {filtered.map((p) => {
                const inCart = cart.find((c) => c.id === p.id);
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors ${inCart ? "bg-teal-50/50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.genericName} · {p.category}</p>
                    </div>
                    <span className={`text-xs ${p.stock <= p.reorderLevel ? "text-amber-500 font-semibold" : "text-gray-400"}`}>{p.stock} {p.unit}s</span>
                    <span className="text-sm font-bold text-teal-700 w-20 text-right">{fmt(p.price)}</span>
                    {inCart && <span className="w-5 h-5 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{inCart.qty}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 mx-auto mb-2 opacity-30"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd"/></svg>
              <p className="text-sm">No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="w-80 xl:w-96 bg-white flex flex-col shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Current Order</h2>
            <p className="text-xs text-gray-400 mt-0.5">{cart.length} item{cart.length !== 1 ? "s" : ""} · {cart.reduce((a, c) => a + c.qty, 0)} units</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Clear all</button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-16">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 opacity-30"><path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/></svg>
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Select items from the left</p>
            </div>
          )}
          {cart.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{c.name}</p>
                  <p className="text-[10px] text-gray-400">{fmt(c.price)} / {c.unit}</p>
                </div>
                <button onClick={() => remove(c.id)} className="text-gray-200 hover:text-red-400 transition-colors mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => c.qty === 1 ? remove(c.id) : setQty(c.id, c.qty - 1)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-bold transition-colors">−</button>
                  <input
                    type="number"
                    value={c.qty}
                    onChange={(e) => setQty(c.id, parseInt(e.target.value) || 1)}
                    className="w-10 h-7 text-center text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                  />
                  <button onClick={() => setQty(c.id, c.qty + 1)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-bold transition-colors">+</button>
                </div>
                <span className="text-sm font-bold text-gray-900">{fmt(c.price * c.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Panel */}
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          {/* Discount */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Discount (₱)"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>−{fmt(discountAmt)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
              <span>TOTAL</span><span>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-4 gap-1.5">
            {["Cash", "GCash", "Maya", "Card"].map((m) => (
              <button key={m} onClick={() => setPayment(m)}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${payment === m ? "bg-teal-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-teal-300"}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Cash Tendered */}
          {payment === "Cash" && (
            <div className="space-y-1.5">
              <input
                type="number"
                placeholder="Amount tendered"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1">
                {[50, 100, 200, 500].map((a) => (
                  <button key={a} onClick={() => setTendered(String(Math.ceil(total / a) * a))}
                    className="py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-teal-300 transition-colors">
                    ₱{a}
                  </button>
                ))}
              </div>
              {tendered && parseFloat(tendered) >= total && (
                <div className="flex justify-between text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                  <span>Change</span><span>{fmt(change)}</span>
                </div>
              )}
            </div>
          )}

          <button onClick={checkout} disabled={!canCheckout}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md">
            {cart.length === 0 ? "Add items to checkout" : `Confirm Payment · ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
