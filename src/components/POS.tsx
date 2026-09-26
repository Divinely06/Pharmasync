import { useState } from "react";
import { CATEGORIES, fmt, type Medicine, type SaleRecord } from "../data";

type CartItem = Medicine & { quantity: number };

type POSProps = {
  products: Medicine[];
  onSale: (sale: SaleRecord, soldItems: { id: number; qty: number }[]) => void;
};

function ReceiptView({ sale, onNew }: { sale: SaleRecord; onNew: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
        <div className="bg-teal-600 px-6 py-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg text-white">✓</div>
          <h2 className="text-lg font-bold text-white">Payment Confirmed</h2>
          <p className="mt-0.5 text-sm text-teal-200">{sale.id}</p>
        </div>
        <div className="space-y-3 p-5">
          {sale.items.map((item) => (
            <div key={item.medicineId} className="flex items-center justify-between text-sm text-gray-600">
              <span>{item.medicineName} × {item.quantity}</span>
              <span className="font-semibold text-gray-800">{fmt(item.subtotal)}</span>
            </div>
          ))}
          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(sale.tax)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
            <div className="mt-2 flex justify-between font-bold text-gray-900"><span>Total</span><span>{fmt(sale.totalAmount)}</span></div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Payment: <strong className="text-gray-700">{sale.paymentMethod}</strong></span>
            <span>{sale.transactionDate} {sale.transactionTime}</span>
          </div>
          <button onClick={onNew} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500">New transaction</button>
        </div>
      </div>
    </div>
  );
}

export default function POS({ products, onSale }: POSProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState("0");
  const [tendered, setTendered] = useState("0");
  const [receipt, setReceipt] = useState<SaleRecord | null>(null);

  const filtered = products.filter((product) => {
    const matchesCategory = category === "All" || product.medicineType === category;
    const haystack = `${product.brandName} ${product.genericName}`.toLowerCase();
    return matchesCategory && haystack.includes(search.toLowerCase()) && product.quantity > 0;
  });

  const addToCart = (product: Medicine) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const setQty = (medicineId: string, nextQty: number) => {
    setCart((prev) => prev.map((item) => (item.id === medicineId ? { ...item, quantity: Math.max(1, nextQty) } : item)));
  };

  const remove = (medicineId: string) => {
    const item = cart.find((entry) => entry.id === medicineId);
    if (!item) return;
    if (!window.confirm(`Remove ${item.brandName} from the current order?`)) return;
    setCart((prev) => prev.filter((entry) => entry.id !== medicineId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountValue = Math.min(subtotal, Math.max(0, Number(discount || 0)));
  const total = Math.max(0, subtotal - discountValue);
  const change = Number(tendered || 0) - total;
  const canCheckout = cart.length > 0 && (paymentMethod !== "Cash" || Number(tendered || 0) >= total);

  const checkout = () => {
    if (!canCheckout) return;

    const now = new Date();
    const sale: SaleRecord = {
      id: `TXN-${Date.now().toString().slice(-4)}`,
      cashierId: "u-cashier",
      cashierName: "Maria Santos",
      transactionDate: now.toISOString().slice(0, 10),
      transactionTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      subtotal,
      discount: discountValue,
      tax: Number((subtotal * 0.1).toFixed(2)),
      totalAmount: Number((total + Number((subtotal * 0.1).toFixed(2))).toFixed(2)),
      paymentMethod,
      amountReceived: Number(tendered || 0),
      changeAmount: Math.max(0, change),
      status: "COMPLETED",
      items: cart.map((item) => ({
        medicineId: item.id,
        medicineName: item.brandName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
    };

    onSale(sale, cart.map((item) => ({ id: Number(item.id.replace(/\D/g, "")) || 1, qty: item.quantity })));
    setReceipt(sale);
    setCart([]);
    setDiscount("0");
    setTendered("0");
  };

  if (receipt) return <ReceiptView sale={receipt} onNew={() => setReceipt(null)} />;

  return (
    <div className="grid h-full gap-5 xl:grid-cols-[1.5fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search medicines" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-teal-500" />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((filter) => (
              <button key={filter} onClick={() => setCategory(filter)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === filter ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No in-stock medicines found.</div>
          ) : (
            filtered.map((product) => (
              <button key={product.id} onClick={() => addToCart(product)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition-all hover:border-teal-300 hover:bg-white">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">{product.medicineType}</span>
                  <span className="text-[10px] text-slate-500">{product.quantity} available</span>
                </div>
                <div className="text-sm font-bold text-slate-800">{product.brandName}</div>
                <div className="mt-1 text-xs text-slate-500">{product.genericName}</div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-teal-700">{fmt(product.unitPrice)}</span>
                  <span className="text-[10px] text-slate-500">{product.dosageForm}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <div className="text-sm font-bold text-slate-900">Current Order</div>
            <div className="text-xs text-slate-500">{cart.length} items</div>
          </div>
          {cart.length > 0 && <button onClick={() => {
            if (!window.confirm("Clear the current order? This cannot be undone.")) return;
            setCart([]);
          }} className="text-xs font-semibold text-red-500">Clear</button>}
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-center text-sm text-slate-400">No items added yet.</div>
          ) : cart.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{item.brandName}</div>
                  <div className="text-[10px] text-slate-500">{fmt(item.unitPrice)} each</div>
                </div>
                <button onClick={() => remove(item.id)} className="text-xs font-medium text-red-500">Remove</button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(item.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-sm">−</button>
                  <input value={item.quantity} onChange={(event) => setQty(item.id, Number(event.target.value || 1))} className="w-12 border border-slate-200 px-2 py-1 text-center text-sm" />
                  <button onClick={() => setQty(item.id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-sm">+</button>
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
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {['Cash', 'GCash', 'Maya', 'Card'].map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Discount</label>
              <input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          {paymentMethod === "Cash" && (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Tendered</label>
              <input value={tendered} onChange={(event) => setTendered(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span>Discount</span><span>-{fmt(discountValue)}</span></div>
            <div className="flex items-center justify-between text-base font-bold text-slate-900"><span>Total</span><span>{fmt(total)}</span></div>
            {paymentMethod === "Cash" && <div className="flex items-center justify-between text-sm"><span>Change</span><span>{fmt(change)}</span></div>}
          </div>

          <button onClick={checkout} disabled={!canCheckout} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">{paymentMethod === "Cash" ? "Complete sale" : `Simulate ${paymentMethod} payment`}</button>
        </div>
      </div>
    </div>
  );
}
