import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  PauseCircle,
  Hand,
  RotateCcw,
  Wrench,
  Package,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Video,
  GitBranch,
  Edit3
} from 'lucide-react';
import {
  CONSTRUCTION_PHASES,
  ACTION_META,
  STATUS_META,
  HOLD_REASON_CATEGORIES,
  TRADE_CATEGORIES,
  formatCurrency,
  formatTimecode,
  getInitials
} from '../lib/api';

export function HoldReasonModal({ task, onClose, onConfirm }) {
  const [category, setCategory] = useState(task?.hold_reason_category || HOLD_REASON_CATEGORIES[0]);
  const [note, setNote] = useState(task?.hold_reason_note || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onConfirm({
        action: 'hold',
        hold_reason_category: category,
        hold_reason_note: note.trim() || category
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-orange-50/60">
          <div className="flex items-center gap-2 text-orange-900">
            <PauseCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-sm">Put Task On Hold</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-900">Task #{task.sequence_order}:</span> {task.title}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hold Reason Category *</label>
            <div className="grid grid-cols-1 gap-1.5">
              {HOLD_REASON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition ${
                    category === cat
                      ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Site Blocker Details (visible to Admin & Crew) *
            </label>
            <textarea
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain what stopped work, what part/inspection/decision is needed to unblock..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Mark On Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CompleteTaskModal({ task, onClose, onConfirm, onLogHours }) {
  const [completionNote, setCompletionNote] = useState(task?.completion_note || '');
  const [finalHours, setFinalHours] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (finalHours && Number(finalHours) > 0 && onLogHours) {
        await onLogHours(task.id, {
          hours: Number(finalHours),
          note: completionNote || 'Final completion shift'
        });
      }
      await onConfirm({
        action: 'complete',
        completion_note: completionNote.trim() || 'Completed and verified on site.'
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm">Complete Renovation Task</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-semibold text-slate-900 mb-0.5">{task.title}</div>
            <div className="text-slate-500">
              Compensation:{' '}
              {task.pay_type === 'fixed'
                ? `${formatCurrency(task.fixed_pay_amount)} Fixed Task Payout`
                : `Hourly (${task.logged_hours} hrs logged so far @ ${formatCurrency(task.effective_hourly_rate)}/hr)`}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Log Final Unrecorded Hours (Optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={finalHours}
              onChange={(e) => setFinalHours(e.target.value)}
              placeholder="e.g. 2.5 (leave blank if already logged)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Completion & Inspection Note</label>
            <textarea
              rows={3}
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="e.g. Pressure tested leak-free for 45 mins, area swept clean for next trade..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? 'Completing...' : 'Mark Task Completed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskFormModal({ propertyId, initialTask, allPropertyTasks = [], crewUsers = [], onClose, onSave }) {
  const isEdit = Boolean(initialTask?.id);
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [room, setRoom] = useState(initialTask?.room || 'Kitchen');
  const [actionType, setActionType] = useState(initialTask?.action_type || 'fix');
  const [tradeCategory, setTradeCategory] = useState(initialTask?.trade_category || 'Rough Plumbing');
  const [sequencePhase, setSequencePhase] = useState(initialTask?.sequence_phase || 3);
  const [sequenceRationale, setSequenceRationale] = useState(initialTask?.sequence_rationale || '');
  const [dependsOn, setDependsOn] = useState(initialTask?.depends_on || []);
  const [estPro, setEstPro] = useState(initialTask?.est_hours_pro ?? 4);
  const [estSkilled, setEstSkilled] = useState(initialTask?.est_hours_skilled ?? 6.5);
  const [estDiy, setEstDiy] = useState(initialTask?.est_hours_diy ?? 11);
  const [payType, setPayType] = useState(initialTask?.pay_type || 'hourly');
  const [fixedPayAmount, setFixedPayAmount] = useState(initialTask?.fixed_pay_amount ?? 225);
  const [hourlyRateOverride, setHourlyRateOverride] = useState(initialTask?.hourly_rate_override ?? '');
  const [assignedTo, setAssignedTo] = useState(initialTask?.assigned_to || '');
  const [tools, setTools] = useState(
    initialTask?.tools || [{ id: `tl-${Date.now()}`, name: 'Cordless Impact Driver', category: 'power', owned: true }]
  );
  const [newToolName, setNewToolName] = useState('');
  const [newToolCategory, setNewToolCategory] = useState('power');
  const [saving, setSaving] = useState(false);

  function autoScaleFromPro(val) {
    const p = Number(val || 1);
    setEstPro(val);
    setEstSkilled(Number((p * 1.65).toFixed(1)));
    setEstDiy(Number((p * 2.8).toFixed(1)));
  }

  function addToolItem() {
    if (!newToolName.trim()) return;
    setTools([
      ...tools,
      {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: newToolName.trim(),
        category: newToolCategory,
        owned: newToolCategory !== 'specialty'
      }
    ]);
    setNewToolName('');
  }

  function toggleDependency(depId) {
    setDependsOn((prev) => (prev.includes(depId) ? prev.filter((x) => x !== depId) : [...prev, depId]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        property_id: propertyId,
        title: title.trim(),
        description: description.trim(),
        room: room.trim() || 'General',
        action_type: actionType,
        trade_category: tradeCategory,
        sequence_phase: Number(sequencePhase),
        sequence_rationale:
          sequenceRationale.trim() ||
          CONSTRUCTION_PHASES.find((p) => p.phase === Number(sequencePhase))?.rule ||
          '',
        depends_on: dependsOn,
        est_hours_pro: Number(estPro || 1),
        est_hours_skilled: Number(estSkilled || 2),
        est_hours_diy: Number(estDiy || 3),
        pay_type: payType,
        fixed_pay_amount: payType === 'fixed' ? Number(fixedPayAmount || 0) : 0,
        hourly_rate_override: payType === 'hourly' && hourlyRateOverride !== '' ? Number(hourlyRateOverride) : null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        tools
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const candidateDeps = allPropertyTasks.filter((t) => t.id !== initialTask?.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl my-auto max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {isEdit ? 'Edit Sequenced Renovation Task' : 'Create Sequenced Renovation Task'}
            </h3>
            <p className="text-xs text-slate-500">
              Configure defect type, construction sequence phase, experience-tier hours, tools & crew compensation
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Task / Scope Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Replace corroded 4-inch cast iron stack w/ Schedule 40 PVC"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Zone</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Kitchen, Basement, Deck..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Action Required</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="fix">Fix / Repair</option>
                <option value="replace">Replace (Tear-Out)</option>
                <option value="update">Update / Modernize</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trade Category</label>
              <select
                value={tradeCategory}
                onChange={(e) => setTradeCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                {TRADE_CATEGORIES.map((tc) => (
                  <option key={tc} value={tc}>
                    {tc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logical Sequence Phase</label>
              <select
                value={sequencePhase}
                onChange={(e) => setSequencePhase(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                {CONSTRUCTION_PHASES.map((p) => (
                  <option key={p.phase} value={p.phase}>
                    {p.short}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Work Scope</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Step-by-step instructions, code specs, inspection checkpoints..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Why This Sequence? (Construction Order Rationale)
            </label>
            <input
              type="text"
              value={sequenceRationale}
              onChange={(e) => setSequenceRationale(e.target.value)}
              placeholder={CONSTRUCTION_PHASES.find((p) => p.phase === Number(sequencePhase))?.rule}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          {/* Estimated Hours by Experience Level */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Estimated Hours by Experience Level</span>
              <span className="text-[11px] text-slate-500">Editing Pro auto-suggests Skilled & DIY</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-emerald-700 mb-1">Licensed Pro (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estPro}
                  onChange={(e) => autoScaleFromPro(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-blue-700 mb-1">Skilled Crew (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estSkilled}
                  onChange={(e) => setEstSkilled(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-amber-700 mb-1">DIY Homeowner (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estDiy}
                  onChange={(e) => setEstDiy(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
            </div>
          </div>

          {/* Labor Compensation Mode: Hourly vs Fixed Amount */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">Labor Compensation & Crew Assignment</span>
              <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setPayType('hourly')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    payType === 'hourly' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Track Hourly Work
                </button>
                <button
                  type="button"
                  onClick={() => setPayType('fixed')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    payType === 'fixed' ? 'bg-amber-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Fixed Task Payout ($)
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Crew / Laborer</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">Open on Crew Board (Unassigned)</option>
                  {crewUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'admin' ? 'Admin' : `$${u.hourly_rate}/hr · ${u.experience_level.toUpperCase()}`})
                    </option>
                  ))}
                </select>
              </div>

              {payType === 'fixed' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fixed Amount Admin Pays on Completion ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={fixedPayAmount}
                    onChange={(e) => setFixedPayAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Task Hourly Rate Override ($/hr, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={hourlyRateOverride}
                    onChange={(e) => setHourlyRateOverride(e.target.value)}
                    placeholder="Uses laborer default $/hr"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Prerequisite Dependencies */}
          {candidateDeps.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Prerequisite Tasks (Must Finish Before Starting This Task)
              </label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {candidateDeps.map((ct) => (
                  <label
                    key={ct.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={dependsOn.includes(ct.id)}
                      onChange={() => toggleDependency(ct.id)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-mono text-slate-400">#{ct.sequence_order}</span>
                    <span className="text-slate-800 truncate flex-1">{ct.title}</span>
                    <span className="text-[10px] text-slate-500">P{ct.sequence_phase}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tools Needed */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tools & Equipment Needed</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToolItem();
                  }
                }}
                placeholder="e.g. Wet Tile Saw, PEX Crimp Tool, Laser Level..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
              <select
                value={newToolCategory}
                onChange={(e) => setNewToolCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="hand">Hand Tool</option>
                <option value="power">Power Tool</option>
                <option value="specialty">Specialty / Rental</option>
              </select>
              <button
                type="button"
                onClick={addToolItem}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((tl) => (
                <span
                  key={tl.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs"
                >
                  <Wrench className="w-3 h-3 text-slate-500" />
                  {tl.name}
                  <button
                    type="button"
                    onClick={() => setTools(tools.filter((x) => x.id !== tl.id))}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Task Changes' : 'Create Sequenced Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskDetailDrawer({
  task,
  currentUser,
  onClose,
  onWorkflowAction,
  onOpenHoldModal,
  onOpenCompleteModal,
  onEditTask,
  onDeleteTask,
  onJumpToVideoPin,
  onAddMaterial,
  onToggleMaterial,
  onDeleteMaterial,
  onToggleToolOwned,
  onLogHours,
  onStartTimer,
  activeTimer
}) {
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('1');
  const [matUnit, setMatUnit] = useState('ea');
  const [matCost, setMatCost] = useState('');
  const [matSupplier, setMatSupplier] = useState('Home Depot Pro');

  const [hoursInput, setHoursInput] = useState('2.0');
  const [hoursNote, setHoursNote] = useState('');

  if (!task) return null;

  const actionStyle = ACTION_META[task.action_type] || ACTION_META.fix;
  const statusStyle = STATUS_META[task.status] || STATUS_META.open;
  const phaseObj = CONSTRUCTION_PHASES.find((p) => p.phase === task.sequence_phase);
  const isAdmin = currentUser?.role === 'admin';
  const isTimerOnThis = activeTimer?.taskId === task.id;

  async function submitNewMaterial(e) {
    e.preventDefault();
    if (!matName.trim()) return;
    await onAddMaterial(task.id, {
      name: matName.trim(),
      quantity: Number(matQty || 1),
      unit: matUnit || 'ea',
      unit_cost: Number(matCost || 0),
      supplier: matSupplier
    });
    setMatName('');
    setMatQty('1');
    setMatCost('');
  }

  async function submitQuickHours(e) {
    e.preventDefault();
    if (!hoursInput || Number(hoursInput) <= 0) return;
    await onLogHours(task.id, {
      hours: Number(hoursInput),
      note: hoursNote.trim() || 'Site work logged'
    });
    setHoursNote('');
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        {/* Top Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                SEQ #{String(task.sequence_order).padStart(2, '0')}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}>
                {actionStyle.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                {statusStyle.label}
              </span>
              <span className="text-xs text-slate-500 font-medium">{task.room} · {task.trade_category}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{task.title}</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={() => onEditTask(task)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-white text-slate-600 hover:text-slate-900"
                  title="Edit Task"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 hover:bg-white text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workflow Action Bar (Admin + Laborer: Accept, Put On Hold w/ Reason, Complete) */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {task.status === 'open' && (
              <button
                onClick={() => onWorkflowAction(task.id, { action: 'accept' })}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Hand className="w-3.5 h-3.5" /> Accept Task
              </button>
            )}
            {task.status === 'on_hold' && (
              <button
                onClick={() => onWorkflowAction(task.id, { action: 'resume' })}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" /> Resume Work
              </button>
            )}
            {task.status !== 'completed' && task.status !== 'on_hold' && (
              <button
                onClick={() => onOpenHoldModal(task)}
                className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <PauseCircle className="w-3.5 h-3.5" /> Put On Hold
              </button>
            )}
            {task.status !== 'completed' && (
              <button
                onClick={() => onOpenCompleteModal(task)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
              </button>
            )}
            {task.status === 'completed' && (
              <button
                onClick={() => onWorkflowAction(task.id, { action: 'reopen' })}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reopen Task
              </button>
            )}
          </div>

          {task.linked_pins?.length > 0 && (
            <button
              onClick={() => onJumpToVideoPin(task.linked_pins[0])}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-amber-600" />
              Watch Defect @ {formatTimecode(task.linked_pins[0].timestamp_sec)}
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* On Hold Banner if active */}
          {task.status === 'on_hold' && (
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-300 text-orange-950">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-orange-800 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                On Hold — {task.hold_reason_category || 'Site Blocker'}
              </div>
              <p className="text-sm text-orange-900 leading-relaxed">{task.hold_reason_note}</p>
            </div>
          )}

          {/* Prerequisite Dependency Warning */}
          {task.is_blocked && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <GitBranch className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Sequence Advisory:</span> Prerequisite task(s) not yet marked completed:{' '}
                {task.blocking_tasks.map((bt) => `#${bt.sequence_order} ${bt.title}`).join(', ')}.
              </div>
            </div>
          )}

          {/* Scope & Sequence Rationale */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Scope & Sequence Rationale</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{task.description || 'No additional scope notes.'}</p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{phaseObj?.short}:</span>{' '}
              {task.sequence_rationale || phaseObj?.rule}
            </div>
          </div>

          {/* 3-Tier Experience Time Estimates */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Estimated Completion Time by Experience Level
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <div className="text-[11px] font-semibold text-emerald-800">Licensed Pro</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{task.est_hours_pro} hrs</div>
                <div className="text-[11px] text-slate-500">Commercial tools</div>
              </div>
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40">
                <div className="text-[11px] font-semibold text-blue-800">Skilled Handyman</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{task.est_hours_skilled} hrs</div>
                <div className="text-[11px] text-slate-500">Multi-trade crew</div>
              </div>
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="text-[11px] font-semibold text-amber-800">DIY Homeowner</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{task.est_hours_diy} hrs</div>
                <div className="text-[11px] text-slate-500">Includes prep curve</div>
              </div>
            </div>
          </div>

          {/* Compensation & Hours Tracking */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Compensation & Hours Worked
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-white border border-slate-200 text-slate-800">
                {task.pay_type === 'fixed'
                  ? `Fixed Task Payout: ${formatCurrency(task.fixed_pay_amount)}`
                  : `Hourly Rate: ${formatCurrency(task.effective_hourly_rate)}/hr`}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
              <div>
                Assignee:{' '}
                <span className="font-semibold text-slate-900">
                  {task.assignee ? `${task.assignee.name} (${task.assignee.persona_type})` : 'Unassigned / Open'}
                </span>
              </div>
              <div className="font-mono">
                Logged: <strong className="text-slate-900">{task.logged_hours}h</strong> · Accrued:{' '}
                <strong className="text-emerald-700">{formatCurrency(task.labor_cost)}</strong>
              </div>
            </div>

            {/* Quick Timer + Manual Hours Entry */}
            <form onSubmit={submitQuickHours} className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className="w-20 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                placeholder="Hrs"
              />
              <input
                type="text"
                value={hoursNote}
                onChange={(e) => setHoursNote(e.target.value)}
                placeholder="Work performed note..."
                className="flex-1 min-w-[150px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" /> Log Hours
              </button>
              {!isTimerOnThis && (
                <button
                  type="button"
                  onClick={() => onStartTimer(task)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" /> Start Shift Timer
                </button>
              )}
            </form>

            {task.time_logs?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {task.time_logs.map((tl) => (
                  <div
                    key={tl.id}
                    className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-slate-200/80"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-800">{tl.user_name}</span>{' '}
                      <span className="text-slate-400">({tl.work_date})</span>
                      {tl.note && <span className="text-slate-600"> — {tl.note}</span>}
                    </div>
                    <span className="font-mono font-semibold text-slate-900 shrink-0">{tl.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materials Needed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Materials Needed ({formatCurrency(task.materials_cost)})
              </h4>
            </div>

            <div className="space-y-1.5 mb-3">
              {task.materials?.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">No materials listed yet.</div>
              ) : (
                task.materials.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={m.purchased}
                        onChange={() => onToggleMaterial(m)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className={m.purchased ? 'line-through text-slate-400 truncate' : 'text-slate-800 font-medium truncate'}>
                        {m.name}
                      </span>
                      <span className="text-slate-400 font-mono shrink-0">
                        {m.quantity} {m.unit}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">{m.supplier}</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatCurrency(m.quantity * m.unit_cost)}
                      </span>
                      <button
                        onClick={() => onDeleteMaterial(m.id)}
                        className="text-slate-300 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitNewMaterial} className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                placeholder="Add material (e.g. 1/2-in Cement Board)..."
                className="col-span-5 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={matQty}
                onChange={(e) => setMatQty(e.target.value)}
                placeholder="Qty"
                className="col-span-2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
              />
              <input
                type="text"
                value={matUnit}
                onChange={(e) => setMatUnit(e.target.value)}
                placeholder="Unit"
                className="col-span-2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={matCost}
                onChange={(e) => setMatCost(e.target.value)}
                placeholder="$/unit"
                className="col-span-2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
              />
              <button
                type="submit"
                className="col-span-1 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800"
                title="Add Material"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Tools Needed */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Tools & Equipment Checklist
            </h4>
            {task.tools?.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No special tools listed.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {task.tools.map((tl) => (
                  <button
                    key={tl.id}
                    type="button"
                    onClick={() => onToggleToolOwned(task, tl.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition ${
                      tl.owned
                        ? 'border-slate-200 bg-white text-slate-800'
                        : 'border-amber-300 bg-amber-50/70 text-amber-950'
                    }`}
                  >
                    <span className="font-medium truncate pr-2">{tl.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        tl.owned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-200/70 text-amber-900'
                      }`}
                    >
                      {tl.owned ? 'On Truck' : 'Need Rental'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
