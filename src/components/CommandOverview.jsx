import React from 'react';
import {
  Video,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Hand,
  PauseCircle,
  Play,
  Wrench,
  Package
} from 'lucide-react';
import {
  ACTION_META,
  STATUS_META,
  CONSTRUCTION_PHASES,
  formatCurrency,
  formatTimecode,
  getInitials
} from '../lib/api';

export default function CommandOverview({
  property,
  walkthroughs,
  tasks,
  currentUser,
  onNavigate,
  onOpenTask,
  onJumpToVideoPin,
  onWorkflowAction,
  onOpenHoldModal,
  onOpenCompleteModal
}) {
  if (!property) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
        Select or create a renovation property to view its dashboard.
      </div>
    );
  }

  const m = property.metrics || {};
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pctDone = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const onHoldTasks = tasks.filter((t) => t.status === 'on_hold');
  const nextSequenceTasks = tasks.filter((t) => t.status !== 'completed').slice(0, 5);
  const allPins = walkthroughs.flatMap((w) => w.pins || []);

  const materialsCommitted = tasks.reduce((s, t) => s + Number(t.materials_cost || 0), 0);
  const laborCommitted = tasks.reduce((s, t) => s + Number(t.labor_cost || 0), 0);
  const totalCommitted = materialsCommitted + laborCommitted;
  const budgetPct = property.rehab_budget > 0 ? Math.min(100, Math.round((totalCommitted / property.rehab_budget) * 100)) : 0;

  const projectedFlipMargin =
    property.purchase_price > 0 && property.arv_estimate > 0
      ? property.arv_estimate - property.purchase_price - property.rehab_budget
      : null;

  return (
    <div className="space-y-5">
      {/* Property Header & FlipperForce / Buildertrend Financial Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                {property.project_type}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {property.status}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {property.sqft?.toLocaleString()} sqft · Built {property.year_built} · Target {property.target_date}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{property.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{property.notes}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('walkthroughs')}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Video className="w-4 h-4" /> Open Video Walkthrough ({allPins.length} Issues)
            </button>
            <button
              onClick={() => onNavigate('sequencer')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <GitBranch className="w-4 h-4" /> Full Sequence
            </button>
          </div>
        </div>

        {/* 4 Executive KPI Tiles */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3.5 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Scope Completion</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {completedCount}/{tasks.length} <span className="text-sm text-emerald-700">({pctDone}%)</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pctDone}%` }} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Rehab Budget vs. Committed</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrency(totalCommitted)}
              <span className="text-xs font-normal text-slate-500"> / {formatCurrency(property.rehab_budget)}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              Labor {formatCurrency(laborCommitted)} · Mat {formatCurrency(materialsCommitted)} ({budgetPct}%)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Est. Hours (Pro vs. DIY)</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {m.est_hours_pro || 0}h <span className="text-xs font-normal text-slate-500">Pro</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              {m.est_hours_skilled || 0}h Skilled · {m.est_hours_diy || 0}h DIY · {m.hours_logged || 0}h logged
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{projectedFlipMargin !== null ? 'Projected Flip Margin' : 'Estimated ARV Value'}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              {projectedFlipMargin !== null
                ? formatCurrency(projectedFlipMargin)
                : formatCurrency(property.arv_estimate)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              {property.purchase_price > 0
                ? `Buy ${formatCurrency(property.purchase_price)} → ARV ${formatCurrency(property.arv_estimate)}`
                : `Post-remodel ARV ${formatCurrency(property.arv_estimate)}`}
            </div>
          </div>
        </div>
      </div>

      {/* ON-HOLD SITE BLOCKER ALERT STRIP (Immediate visibility for Admin & Crew!) */}
      {onHoldTasks.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-950 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Active On-Hold Site Blockers ({onHoldTasks.length}) — Requires Attention
            </div>
            <button
              onClick={() => onNavigate('board')}
              className="text-xs font-semibold text-orange-800 hover:underline"
            >
              Manage on Crew Board →
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {onHoldTasks.map((ht) => (
              <div
                key={ht.id}
                onClick={() => onOpenTask(ht)}
                className="bg-white rounded-xl border border-orange-200 p-3.5 cursor-pointer hover:border-orange-400 transition flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Seq #{ht.sequence_order}: {ht.title}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold shrink-0">
                      {ht.hold_reason_category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{ht.hold_reason_note}</p>
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-slate-500">
                    Flagged by: <strong>{ht.assignee?.name || 'Crew'}</strong>
                  </span>
                  <button
                    onClick={() => onWorkflowAction(ht.id, { action: 'resume' })}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" /> Unblock & Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split: Next Up in Logical Sequence (7 cols) + Video Issue Callouts Breakdown (5 cols) */}
      <div className="grid xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Active Critical Path Queue */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Next Up in Logical Build Sequence</h2>
              <p className="text-xs text-slate-500">
                Ordered by critical construction phase — accept, pause with reason, or complete directly
              </p>
            </div>
            <button
              onClick={() => onNavigate('sequencer')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
            >
              All {tasks.length} Tasks <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 space-y-2">
                <p>No tasks added yet!</p>
                <button
                  onClick={() => onNavigate('walkthroughs')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                >
                  Open Video Walkthroughs → Speak & Auto-Build Tasks
                </button>
              </div>
            ) : nextSequenceTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-emerald-700 font-semibold">
                All {tasks.length} tasks in this renovation scope are completed!
              </div>
            ) : (
              nextSequenceTasks.map((task) => {
                const actionMeta = ACTION_META[task.action_type] || ACTION_META.fix;
                const statusMeta = STATUS_META[task.status] || STATUS_META.open;
                const phaseObj = CONSTRUCTION_PHASES.find((p) => p.phase === task.sequence_phase);

                return (
                  <div
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="p-4 hover:bg-slate-50/80 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                          SEQ #{String(task.sequence_order).padStart(2, '0')}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${actionMeta.bg} ${actionMeta.text} ${actionMeta.border}`}>
                          {actionMeta.short}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusMeta.bg} ${statusMeta.text}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-[11px] text-slate-400">{phaseObj?.short}</span>
                      </div>

                      <div className="text-sm font-bold text-slate-900">{task.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{task.room}</span>
                        <span>· Pro {task.est_hours_pro}h / DIY {task.est_hours_diy}h</span>
                        <span>
                          ·{' '}
                          {task.pay_type === 'fixed'
                            ? `${formatCurrency(task.fixed_pay_amount)} fixed`
                            : `${formatCurrency(task.effective_hourly_rate)}/hr`}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.status === 'open' && (
                        <button
                          onClick={() => onWorkflowAction(task.id, { action: 'accept' })}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Hand className="w-3 h-3" /> Accept
                        </button>
                      )}
                      {task.status === 'accepted' && (
                        <>
                          <button
                            onClick={() => onOpenHoldModal(task)}
                            className="px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-semibold"
                          >
                            Hold
                          </button>
                          <button
                            onClick={() => onOpenCompleteModal(task)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            Complete
                          </button>
                        </>
                      )}
                      {task.status === 'on_hold' && (
                        <button
                          onClick={() => onWorkflowAction(task.id, { action: 'resume' })}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 5 Cols: Video Walkthrough Defect Callouts Preview */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Walkthrough Defect Callouts</h2>
              <p className="text-xs text-slate-500">Jump directly to timestamped Fix, Replace & Update pins</p>
            </div>
            <button
              onClick={() => onNavigate('walkthroughs')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
            >
              Studio <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini Action Breakdown */}
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 border-b border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-white border border-rose-200">
              <div className="text-base font-bold font-mono text-rose-700">
                {allPins.filter((p) => p.action_type === 'fix').length}
              </div>
              <div className="text-[10px] font-bold uppercase text-rose-600">Fix / Repair</div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-amber-200">
              <div className="text-base font-bold font-mono text-amber-800">
                {allPins.filter((p) => p.action_type === 'replace').length}
              </div>
              <div className="text-[10px] font-bold uppercase text-amber-700">Replace</div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-sky-200">
              <div className="text-base font-bold font-mono text-sky-700">
                {allPins.filter((p) => p.action_type === 'update').length}
              </div>
              <div className="text-[10px] font-bold uppercase text-sky-700">Update</div>
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
            {allPins.slice(0, 7).map((pin) => {
              const meta = ACTION_META[pin.action_type] || ACTION_META.fix;
              return (
                <button
                  key={pin.id}
                  onClick={() => onJumpToVideoPin(pin)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${meta.bg} ${meta.text}`}>
                        {meta.short}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 truncate">{pin.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {pin.room} — {pin.description}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-amber-400 font-mono text-[11px] font-semibold shrink-0">
                    @{formatTimecode(pin.timestamp_sec)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
