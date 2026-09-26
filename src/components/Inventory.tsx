import { useState } from "react";
import { fmt, type Medicine } from "../data";

type SortKey = "brandName" | "quantity" | "unitPrice" | "expirationDate";

const initialDraft = (): Partial<Medicine> => ({
  brandName: "",
  genericName: "",
  medicineType: "Antibiotics",
  unitPrice: 0,
  quantity: 0,
  reorderLevel: 20,
  batchNumber: "",
  expirationDate: "",
  supplierId: "",
  status: "ACTIVE",
});

function InventoryTableRow({ item, onEdit, onDelete }: { item: Medicine; onEdit: (item: Medicine) => void; onDelete: (id: string) => void }) {
  const expiresSoon = new Date(item.expirationDate).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(expiresSoon / 86400000));

  return (
    <tr className="group transition-colors hover:bg-gray-50/60">
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900">{item.brandName}</p>
        <p className="text-xs text-gray-400">{item.genericName}</p>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{item.medicineType}</span>
      </td>
      <td className="px-4 py-3 font-semibold text-gray-800">{fmt(item.unitPrice)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${item.quantity === 0 ? "text-red-600" : item.quantity <= item.reorderLevel ? "text-amber-600" : "text-gray-800"}`}>{item.quantity}</span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.batchNumber}</td>
      <td className="px-4 py-3">
        <span className={`text-xs ${daysLeft <= 90 ? "font-semibold text-orange-600" : "text-gray-500"}`}>{item.expirationDate}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{item.supplierId}</td>
      <td className="px-4 py-3">
        {item.quantity === 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Out</span> : item.quantity <= item.reorderLevel ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Low</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">OK</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => onEdit(item)} className="text-xs font-semibold text-teal-600 hover:text-teal-800">Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-xs font-semibold text-red-400 hover:text-red-600">Delete</button>
        </div>
      </td>
    </tr>
  );
}

export default function Inventory({ products, setProducts }: { products: Medicine[]; setProducts: React.Dispatch<React.SetStateAction<Medicine[]>> }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("brandName");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState<Partial<Medicine>>(initialDraft());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products
    .filter((item) => {
      const terms = `${item.brandName} ${item.genericName} ${item.batchNumber}`.toLowerCase();
      return terms.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const values = {
        brandName: a.brandName.localeCompare(b.brandName),
        quantity: a.quantity - b.quantity,
        unitPrice: a.unitPrice - b.unitPrice,
        expirationDate: a.expirationDate.localeCompare(b.expirationDate),
      };
      return sortAsc ? values[sortKey] : -values[sortKey];
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const openAdd = () => {
    setDraft(initialDraft());
    setModal("add");
  };

  const openEdit = (item: Medicine) => {
    setDraft(item);
    setModal("edit");
  };

  const save = () => {
    if (!draft.brandName || !draft.batchNumber || !draft.expirationDate) return;
    const base = {
      id: draft.id ?? `med-${Date.now()}`,
      barcode: draft.barcode ?? "",
      genericName: draft.genericName ?? "",
      brandName: draft.brandName,
      medicineType: draft.medicineType ?? "Antibiotics",
      dosageForm: draft.dosageForm ?? "Tablet",
      strength: draft.strength ?? "",
      prescriptionRequired: draft.prescriptionRequired ?? false,
      description: draft.description ?? "",
      dosageInformation: draft.dosageInformation ?? "",
      precautions: draft.precautions ?? "",
      contraindications: draft.contraindications ?? "",
      storageInformation: draft.storageInformation ?? "",
      supplierId: draft.supplierId ?? "",
      unitPrice: Number(draft.unitPrice ?? 0),
      quantity: Number(draft.quantity ?? 0),
      reorderLevel: Number(draft.reorderLevel ?? 20),
      expirationDate: draft.expirationDate,
      batchNumber: draft.batchNumber,
      status: draft.status ?? "ACTIVE",
      createdAt: draft.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Medicine;

    setProducts((prev) => {
      if (modal === "edit" && draft.id) {
        return prev.map((item) => (item.id === draft.id ? base : item));
      }
      return [...prev, base];
    });
    setModal(null);
  };

  const del = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-0.5 text-sm text-gray-400">{products.length} products in the catalog</p>
        </div>
        <button onClick={openAdd} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500">Add Product</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" className="min-w-48 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-500" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left"><button onClick={() => toggleSort("brandName")} className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800">Product</button></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-4 py-3 text-left"><button onClick={() => toggleSort("unitPrice")} className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800">Price</button></th>
                <th className="px-4 py-3 text-left"><button onClick={() => toggleSort("quantity")} className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800">Stock</button></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Batch</th>
                <th className="px-4 py-3 text-left"><button onClick={() => toggleSort("expirationDate")} className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800">Expiry</button></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <InventoryTableRow key={item.id} item={item} onEdit={openEdit} onDelete={(id) => setDeleteId(id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-base font-bold text-gray-900">{modal === "add" ? "Add Product" : "Edit Product"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Brand name</label>
                <input value={draft.brandName ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, brandName: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Generic name</label>
                <input value={draft.genericName ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, genericName: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Price</label>
                <input type="number" value={draft.unitPrice ?? 0} onChange={(event) => setDraft((prev) => ({ ...prev, unitPrice: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Stock</label>
                <input type="number" value={draft.quantity ?? 0} onChange={(event) => setDraft((prev) => ({ ...prev, quantity: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Reorder level</label>
                <input type="number" value={draft.reorderLevel ?? 0} onChange={(event) => setDraft((prev) => ({ ...prev, reorderLevel: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Batch number</label>
                <input value={draft.batchNumber ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, batchNumber: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Expiration</label>
                <input type="date" value={draft.expirationDate ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, expirationDate: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Category</label>
                <input value={draft.medicineType ?? "Antibiotics"} onChange={(event) => setDraft((prev) => ({ ...prev, medicineType: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={save} className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500">Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-gray-900">Delete product?</h3>
            <p className="mb-5 text-sm text-gray-400">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => del(deleteId)} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
