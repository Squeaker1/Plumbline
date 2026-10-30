import React, { useState } from 'react';
import {
  Package,
  Wrench,
  CheckCircle2,
  ShoppingCart,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '../lib/api';

export default function MaterialsToolsView({
  tasks,
  onToggleMaterial,
  onAddMaterial,
  onDeleteMaterial,
  onToggleToolOwned,
  onOpenTask
}) {
  const [filterMat, setFilterMat] = useState('all'); // 'all' | 'needed' | 'purchased'
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Quick Add Material state
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || '');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('ea');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('Home Depot Pro');

  const allMaterials = tasks.flatMap((t) =>
    (t.materials || []).map((m) => ({
      ...m,
      task_title: t.title,
      sequence_order: t.sequence_order,
      sequence_phase: t.sequence_phase,
      task_obj: t
    }))
  );

  const suppliers = Array.from(new Set(allMaterials.map((m) => m.supplier).filter(Boolean)));

  const filteredMaterials = allMaterials.filter((m) => {
    if (filterMat === 'needed' && m.purchased) return false;
    if (filterMat === 'purchased' && !m.purchased) return false;
    if (supplierFilter !== 'all' && m.supplier !== supplierFilter) return false;
    return true;
  });

  const totalMatBudget = allMaterials.reduce((s, m) => s + m.quantity * m.unit_cost, 0);
  const purchasedTotal = allMaterials
    .filter((m) => m.purchased)
    .reduce((s, m) => s + m.quantity * m.unit_cost, 0);
  const remainingToBuy = totalMatBudget - purchasedTotal;

  const allTools = tasks.flatMap((t) =>
    (t.tools || []).map((tl) => ({
      ...tl,
      task_id: t.id,
      task_title: t.title,
      sequence_order: t.sequence_order,
      task_obj: t
    }))
  );
  const rentalTools = allTools.filter((tl) => !tl.owned);

  async function handleQuickAdd(e) {
    e.preventDefault();
    const tid = Number(selectedTaskId || tasks[0]?.id);
    if (!tid || !name.trim()) return;
    await onAddMaterial(tid, {
      name: name.trim(),
      quantity: Number(quantity || 1),
      unit: unit || 'ea',
      unit_cost: Number(unitCost || 0),
      supplier
    });
    setName('');
    setQuantity('1');
    setUnitCost('');
  }

  return (
    <div className="space-y-5">
      {/* Summary KPI Bar */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Material Take-Off</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{formatCurrency(totalMatBudget)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{allMaterials.length} line items across scope</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-emerald-700">Purchased / On-Site</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{formatCurrency(purchasedTotal)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {allMaterials.filter((m) => m.purchased).length} items staged
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-amber-700">Remaining Supply Run</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{formatCurrency(remainingToBuy)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {allMaterials.filter((m) => !m.purchased).length} items to buy
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700">Tool & Rental Readiness</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {rentalTools.length === 0 ? 'All Owned' : `${rentalTools.length} Rentals`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{allTools.length} required tools listed</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-5 items-start">
        {/* Left 8 Cols: Consolidated Material Take-Off & Shopping List */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-sm text-slate-900">Property Material Take-Off & Supply Run List</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'needed', label: 'To Buy' },
                  { id: 'purchased', label: 'Purchased' }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setFilterMat(b.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                      filterMat === b.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Add Material Bar */}
          {tasks.length > 0 && (
            <form onSubmit={handleQuickAdd} className="p-3 bg-slate-50 border-b border-slate-200 grid sm:grid-cols-12 gap-2">
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="sm:col-span-3 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.sequence_order} {t.title.slice(0, 28)}...
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Material item name..."
                className="sm:col-span-3 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <input
                type="number"
                step="0.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Qty"
                className="sm:col-span-1 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit"
                className="sm:col-span-1 px-2 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="$/ea"
                className="sm:col-span-2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
              <button
                type="submit"
                className="sm:col-span-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {filteredMaterials.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No materials match the selected filter.
              </div>
            ) : (
              filteredMaterials.map((m) => (
                <div
                  key={m.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={m.purchased}
                      onChange={() => onToggleMaterial(m)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-semibold ${
                          m.purchased ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {m.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                        <button
                          type="button"
                          onClick={() => onOpenTask(m.task_obj)}
                          className="font-mono text-amber-700 hover:underline"
                        >
                          Seq #{m.sequence_order} (P{m.sequence_phase})
                        </button>
                        <span>· {m.supplier}</span>
                        <span>
                          · {m.quantity} {m.unit} @ {formatCurrency(m.unit_cost)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {formatCurrency(m.quantity * m.unit_cost)}
                    </span>
                    <button
                      onClick={() => onDeleteMaterial(m.id)}
                      className="text-slate-300 hover:text-rose-600"
                      title="Remove Material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 4 Cols: Required Tools & Specialty Rentals */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-700" />
              <h3 className="font-bold text-sm text-slate-900">Tools & Equipment Readiness</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any tool to toggle between <strong>On Truck</strong> and <strong>Need Rental</strong>
            </p>
          </div>

          <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
            {allTools.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No tools listed on tasks yet.</div>
            ) : (
              allTools.map((tl) => (
                <button
                  key={`${tl.task_id}-${tl.id}`}
                  type="button"
                  onClick={() => onToggleToolOwned(tl.task_obj, tl.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                    tl.owned
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-amber-300 bg-amber-50/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{tl.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Seq #{tl.sequence_order}: {tl.task_title}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      tl.owned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-200 text-amber-950'
                    }`}
                  >
                    {tl.owned ? 'On Truck' : 'Rent / Buy'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
