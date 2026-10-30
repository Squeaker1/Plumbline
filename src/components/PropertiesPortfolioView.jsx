import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Video,
  TrendingUp,
  Calendar,
  MapPin,
  X
} from 'lucide-react';
import { formatCurrency } from '../lib/api';

export default function PropertiesPortfolioView({
  properties,
  activePropertyId,
  currentUser,
  onSelectProperty,
  onCreateProperty,
  onUpdateProperty,
  onDeleteProperty
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Renovation Portfolio & Property Scope</h2>
          <p className="text-xs text-slate-500">
            Manage Fix & Flip investments, Homeowner Remodels, and Contractor Rehab projects
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Renovation Property
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {properties.map((prop) => {
          const isActive = prop.id === activePropertyId;
          const m = prop.metrics || {};
          const pctDone = m.total_tasks ? Math.round((m.completed_tasks / m.total_tasks) * 100) : 0;
          const projectedGrossMargin =
            prop.arv_estimate > 0 && prop.purchase_price > 0
              ? prop.arv_estimate - prop.purchase_price - prop.rehab_budget
              : null;

          return (
            <div
              key={prop.id}
              onClick={() => onSelectProperty(prop.id)}
              className={`bg-white rounded-2xl border overflow-hidden transition cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="relative h-40 bg-slate-900 overflow-hidden">
                  <img
                    src={prop.cover_image || '/media/frames/exterior_deck_roof.jpg'}
                    alt={prop.name}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950">
                      {prop.project_type}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900/80 text-white backdrop-blur-sm">
                      {prop.status}
                    </span>
                  </div>
                  {isActive && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">
                      ACTIVE WORKSPACE
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-bold text-sm truncate">{prop.name}</h3>
                    <div className="text-xs text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      {prop.address}, {prop.city_state}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>{prop.sqft.toLocaleString()} sqft · Built {prop.year_built}</span>
                    <span>{prop.beds} bd / {prop.baths} ba</span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">
                        Scope Progress ({m.completed_tasks || 0}/{m.total_tasks || 0} tasks)
                      </span>
                      <span className="font-mono font-bold text-slate-900">{pctDone}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${pctDone}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial / FlipperForce style metrics */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Rehab Budget</div>
                      <div className="font-mono font-bold text-slate-900">{formatCurrency(prop.rehab_budget)}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatCurrency(m.total_committed_spend || 0)} committed
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        {projectedGrossMargin !== null ? 'Est. Flip Margin' : 'Target ARV'}
                      </div>
                      <div className="font-mono font-bold text-emerald-700">
                        {projectedGrossMargin !== null
                          ? formatCurrency(projectedGrossMargin)
                          : formatCurrency(prop.arv_estimate)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ARV {formatCurrency(prop.arv_estimate)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{prop.notes}</p>
                </div>
              </div>

              <div
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3 text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Video className="w-3.5 h-3.5 text-amber-600" />
                    {m.walkthrough_count || 0} videos · {m.pin_count || 0} pins
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingProperty(prop)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                      title="Edit Property"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {properties.length > 1 && (
                      <button
                        onClick={() => onDeleteProperty(prop.id)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                        title="Delete Property"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(showNewModal || editingProperty) && (
        <PropertyFormModal
          initialProperty={editingProperty}
          onClose={() => {
            setShowNewModal(false);
            setEditingProperty(null);
          }}
          onSave={async (payload) => {
            if (editingProperty) {
              await onUpdateProperty(editingProperty.id, payload);
            } else {
              await onCreateProperty(payload);
            }
            setShowNewModal(false);
            setEditingProperty(null);
          }}
        />
      )}
    </div>
  );
}

function PropertyFormModal({ initialProperty, onClose, onSave }) {
  const isEdit = Boolean(initialProperty);
  const [name, setName] = useState(initialProperty?.name || '');
  const [address, setAddress] = useState(initialProperty?.address || '');
  const [cityState, setCityState] = useState(initialProperty?.city_state || 'Knoxville, TN');
  const [projectType, setProjectType] = useState(initialProperty?.project_type || 'Fix & Flip');
  const [status, setStatus] = useState(initialProperty?.status || 'Active Rehab');
  const [sqft, setSqft] = useState(initialProperty?.sqft ?? 1850);
  const [yearBuilt, setYearBuilt] = useState(initialProperty?.year_built ?? 1968);
  const [beds, setBeds] = useState(initialProperty?.beds ?? 3);
  const [baths, setBaths] = useState(initialProperty?.baths ?? 2);
  const [purchasePrice, setPurchasePrice] = useState(initialProperty?.purchase_price ?? 195000);
  const [rehabBudget, setRehabBudget] = useState(initialProperty?.rehab_budget ?? 55000);
  const [arvEstimate, setArvEstimate] = useState(initialProperty?.arv_estimate ?? 335000);
  const [targetDate, setTargetDate] = useState(initialProperty?.target_date || '2026-12-30');
  const [coverImage, setCoverImage] = useState(initialProperty?.cover_image || '/media/frames/exterior_deck_roof.jpg');
  const [notes, setNotes] = useState(initialProperty?.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        address,
        city_state: cityState,
        project_type: projectType,
        status,
        sqft: Number(sqft),
        year_built: Number(yearBuilt),
        beds: Number(beds),
        baths: Number(baths),
        purchase_price: Number(purchasePrice || 0),
        rehab_budget: Number(rehabBudget || 0),
        arv_estimate: Number(arvEstimate || 0),
        target_date: targetDate,
        cover_image: coverImage,
        notes
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            {isEdit ? 'Edit Property Details & Rehab Budget' : 'Create New Renovation Property'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 814 Oakwood Bungalow Flip"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="Fix & Flip">Fix & Flip</option>
                <option value="Homeowner Remodel">Homeowner Remodel</option>
                <option value="Client Contract">Client Contract</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="814 Oakwood Ave"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City, State</label>
              <input
                type="text"
                value={cityState}
                onChange={(e) => setCityState(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sq Ft</label>
              <input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Year Built</label>
              <input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Beds</label>
              <input
                type="number"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baths</label>
              <input
                type="number"
                step="0.5"
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Price ($)</label>
              <input
                type="number"
                step="500"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rehab Budget ($)</label>
              <input
                type="number"
                step="500"
                value={rehabBudget}
                onChange={(e) => setRehabBudget(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target ARV ($)</label>
              <input
                type="number"
                step="500"
                value={arvEstimate}
                onChange={(e) => setArvEstimate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="Inspection & Scope">Inspection & Scope</option>
                <option value="Active Rehab">Active Rehab</option>
                <option value="Punch List">Punch List</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Completion</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cover Photo</label>
              <select
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="/media/frames/exterior_deck_roof.jpg">Craftsman Exterior & Deck</option>
                <option value="/media/frames/kitchen_inspection.jpg">Kitchen Rehab View</option>
                <option value="/media/frames/bathroom_inspection.jpg">Primary Bath View</option>
                <option value="/media/frames/basement_mechanicals.jpg">Basement Mechanicals</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Strategy & Scope Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
