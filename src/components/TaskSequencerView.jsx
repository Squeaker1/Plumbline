import React, { useState } from 'react';
import {
  GitBranch,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Clock,
  Wrench,
  Package,
  Video,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Plus,
  Lock,
  Unlock
} from 'lucide-react';
import {
  CONSTRUCTION_PHASES,
  ACTION_META,
  STATUS_META,
  EXPERIENCE_META,
  formatCurrency,
  formatTimecode
} from '../lib/api';

export default function TaskSequencerView({
  property,
  tasks,
  currentUser,
  onOpenTask,
  onOpenNewTask,
  onResequence,
  onJumpToVideoPin
}) {
  const [selectedExp, setSelectedExp] = useState('pro'); // 'pro' | 'skilled' | 'diy' | 'assigned'
  const [viewMode, setViewMode] = useState('phases'); // 'phases' | 'linear'
  const isAdmin = currentUser?.role === 'admin';

  function getTaskHoursForMode(task, mode = selectedExp) {
    if (mode === 'diy') return Number(task.est_hours_diy || 0);
    if (mode === 'skilled') return Number(task.est_hours_skilled || 0);
    if (mode === 'pro') return Number(task.est_hours_pro || 0);
    // 'assigned' uses assigned crew's actual experience level, defaulting to skilled
    const exp = task.assignee?.experience_level || 'skilled';
    if (exp === 'diy') return Number(task.est_hours_diy || 0);
    if (exp === 'pro') return Number(task.est_hours_pro || 0);
    return Number(task.est_hours_skilled || 0);
  }

  const totalPro = tasks.reduce((s, t) => s + Number(t.est_hours_pro || 0), 0);
  const totalSkilled = tasks.reduce((s, t) => s + Number(t.est_hours_skilled || 0), 0);
  const totalDiy = tasks.reduce((s, t) => s + Number(t.est_hours_diy || 0), 0);
  const activeTotalHours = tasks.reduce((s, t) => s + getTaskHoursForMode(t, selectedExp), 0);
  const remainingHours = tasks
    .filter((t) => t.status !== 'completed')
    .reduce((s, t) => s + getTaskHoursForMode(t, selectedExp), 0);

  async function moveTask(index, direction) {
    const next = [...tasks];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    await onResequence(next.map((t) => t.id));
  }

  return (
    <div className="space-y-5">
      {/* Experience-Level Time Estimator & Sequence Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">
                Logical Construction Sequence & Experience Time Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Tasks are ordered from structural dry-in and rough-in MEP through drywall close-in, tile, cabinetry, and finish trim so crew members never undo finished work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setViewMode('phases')}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  viewMode === 'phases' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                8-Phase Groups
              </button>
              <button
                onClick={() => setViewMode('linear')}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  viewMode === 'linear' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Step-by-Step Queue
              </button>
            </div>

            {isAdmin && (
              <>
                <button
                  onClick={() => onResequence(null)}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Auto-Optimize Sequence
                </button>
                <button
                  onClick={onOpenNewTask}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>
              </>
            )}
          </div>
        </div>

        {/* Interactive Experience Tier Selector Cards */}
        <div className="grid sm:grid-cols-4 gap-3 pt-1">
          {[
            {
              id: 'pro',
              title: 'Licensed Pro Crew',
              hours: totalPro,
              sub: `~${Math.ceil(totalPro / 8)} crew days (8h/day)`,
              accent: 'border-emerald-500 bg-emerald-50/50'
            },
            {
              id: 'skilled',
              title: 'Skilled Handyman',
              hours: totalSkilled,
              sub: `~${Math.ceil(totalSkilled / 8)} workdays (+${(totalSkilled - totalPro).toFixed(1)}h vs Pro)`,
              accent: 'border-blue-500 bg-blue-50/50'
            },
            {
              id: 'diy',
              title: 'DIY Homeowner',
              hours: totalDiy,
              sub: `~${Math.ceil(totalDiy / 8)} full days (+${(totalDiy - totalPro).toFixed(1)}h learning curve)`,
              accent: 'border-amber-500 bg-amber-50/50'
            },
            {
              id: 'assigned',
              title: 'Assigned Crew Mix',
              hours: tasks.reduce((s, t) => s + getTaskHoursForMode(t, 'assigned'), 0),
              sub: `${remainingHours.toFixed(1)}h remaining on open work`,
              accent: 'border-slate-900 bg-slate-100'
            }
          ].map((card) => {
            const active = selectedExp === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedExp(card.id)}
                className={`p-3.5 rounded-xl border text-left transition ${
                  active ? `${card.accent} ring-2 ring-slate-900/10` : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{card.title}</span>
                  <Clock className={`w-3.5 h-3.5 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                  {card.hours.toFixed(1)} hrs
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{card.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Instant Active Selection Banner */}
        <div className="p-3 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-amber-400 font-bold uppercase font-mono mr-2">Active Estimate:</span>
            <strong>{EXPERIENCE_META[selectedExp]?.label || 'Assigned Crew Mix'}</strong> —{' '}
            <span className="font-mono font-bold text-amber-300">{activeTotalHours.toFixed(1)} total hours</span>{' '}
            (~{Math.ceil(activeTotalHours / 8)} workdays).
          </div>
          <span className="text-slate-300">↓ Scroll down to see all tasks in First-to-Last build order</span>
        </div>
      </div>

      {/* Empty State */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">No Sequenced Tasks Yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Add renovation tasks or pin issues directly inside the Video Walkthrough Studio to build your critical path.
          </p>
          {isAdmin && (
            <button
              onClick={onOpenNewTask}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create First Task
            </button>
          )}
        </div>
      ) : viewMode === 'phases' ? (
        /* 8-Phase Grouped Critical Path View */
        <div className="space-y-4">
          {CONSTRUCTION_PHASES.map((phaseObj) => {
            const phaseTasks = tasks.filter((t) => t.sequence_phase === phaseObj.phase);
            if (phaseTasks.length === 0) return null;
            const phaseHours = phaseTasks.reduce((s, t) => s + getTaskHoursForMode(t), 0);
            const doneCount = phaseTasks.filter((t) => t.status === 'completed').length;

            return (
              <div
                key={phaseObj.phase}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 font-mono text-xs font-bold flex items-center justify-center">
                      P{phaseObj.phase}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{phaseObj.name}</h3>
                      <p className="text-[11px] text-slate-500">{phaseObj.rule}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-slate-600">
                      {doneCount}/{phaseTasks.length} done
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-900">
                      {phaseHours.toFixed(1)} hrs ({EXPERIENCE_META[selectedExp]?.short || 'Crew Mix'})
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {phaseTasks.map((task) => (
                    <SequenceTaskRow
                      key={task.id}
                      task={task}
                      estHours={getTaskHoursForMode(task)}
                      selectedExp={selectedExp}
                      isAdmin={isAdmin}
                      canReorder={false}
                      onOpenTask={onOpenTask}
                      onJumpToVideoPin={onJumpToVideoPin}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Step-by-Step Linear Queue with Manual Reordering */
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
          {tasks.map((task, idx) => (
            <SequenceTaskRow
              key={task.id}
              task={task}
              estHours={getTaskHoursForMode(task)}
              selectedExp={selectedExp}
              isAdmin={isAdmin}
              canReorder={isAdmin}
              isFirst={idx === 0}
              isLast={idx === tasks.length - 1}
              onMoveUp={() => moveTask(idx, -1)}
              onMoveDown={() => moveTask(idx, 1)}
              onOpenTask={onOpenTask}
              onJumpToVideoPin={onJumpToVideoPin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SequenceTaskRow({
  task,
  estHours,
  isAdmin,
  canReorder,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onOpenTask,
  onJumpToVideoPin
}) {
  const actionStyle = ACTION_META[task.action_type] || ACTION_META.fix;
  const statusStyle = STATUS_META[task.status] || STATUS_META.open;
  const unownedTools = (task.tools || []).filter((tl) => !tl.owned);

  return (
    <div
      onClick={() => onOpenTask(task)}
      className="px-5 py-4 hover:bg-slate-50/80 transition cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {/* Sequence Number + Optional Reorder Controls */}
        <div className="flex flex-col items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span
            className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${
              task.status === 'completed'
                ? 'bg-emerald-100 text-emerald-800'
                : task.status === 'on_hold'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-slate-900 text-white'
            }`}
          >
            #{String(task.sequence_order).padStart(2, '0')}
          </span>
          {canReorder && (
            <div className="flex items-center gap-0.5">
              <button
                disabled={isFirst}
                onClick={onMoveUp}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-25"
                title="Move Earlier in Sequence"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={isLast}
                onClick={onMoveDown}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-25"
                title="Move Later in Sequence"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}>
              {actionStyle.short}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              {statusStyle.label}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {task.room} · {task.trade_category}
            </span>

            {/* Ready vs Blocked Dependency Pill */}
            {task.status !== 'completed' && (
              task.is_blocked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                  <Lock className="w-3 h-3" />
                  After {task.blocking_tasks.map((b) => `#${b.sequence_order}`).join(', ')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                  <Unlock className="w-3 h-3" /> Ready in Sequence
                </span>
              )
            )}
          </div>

          <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>

          {task.sequence_rationale && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
              <strong className="text-slate-700">Why here:</strong> {task.sequence_rationale}
            </p>
          )}

          {task.status === 'on_hold' && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="font-semibold">{task.hold_reason_category}:</span>
              <span className="truncate max-w-md">{task.hold_reason_note}</span>
            </div>
          )}

          {/* Materials, Tools & Video Callout Sub-badges */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {task.materials?.length || 0} materials ({formatCurrency(task.materials_cost)})
            </span>
            <span className="inline-flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-slate-400" />
              {task.tools?.length || 0} tools
              {unownedTools.length > 0 && (
                <span className="text-amber-700 font-semibold">({unownedTools.length} rental)</span>
              )}
            </span>
            {task.linked_pins?.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToVideoPin(task.linked_pins[0]);
                }}
                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-semibold"
              >
                <Video className="w-3.5 h-3.5" />
                Video @{formatTimecode(task.linked_pins[0].timestamp_sec)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Experience Hours + Pay Info */}
      <div className="flex sm:items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
        <div className="text-left lg:text-right">
          <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{estHours.toFixed(1)} hrs est.</div>
          <div className="text-[11px] font-mono text-slate-400">
            Pro {task.est_hours_pro}h · Skill {task.est_hours_skilled}h · DIY {task.est_hours_diy}h
          </div>
        </div>

        <div className="text-right min-w-[110px]">
          <div className="text-xs font-mono font-bold text-slate-800">
            {task.pay_type === 'fixed'
              ? `${formatCurrency(task.fixed_pay_amount)} fixed`
              : `${formatCurrency(task.effective_hourly_rate)}/hr`}
          </div>
          <div className="text-[11px] text-slate-500 truncate max-w-[120px]">
            {task.assignee ? task.assignee.name : 'Open Task'}
          </div>
        </div>
      </div>
    </div>
  );
}
