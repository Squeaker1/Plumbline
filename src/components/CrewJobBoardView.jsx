import React, { useState } from 'react';
import {
  Hand,
  PauseCircle,
  CheckCircle2,
  Play,
  Video,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Wrench,
  Package,
  Filter
} from 'lucide-react';
import {
  ACTION_META,
  STATUS_META,
  formatCurrency,
  formatTimecode,
  getInitials
} from '../lib/api';

export default function CrewJobBoardView({
  tasks,
  currentUser,
  onOpenTask,
  onOpenNewTask,
  onWorkflowAction,
  onOpenHoldModal,
  onOpenCompleteModal,
  onJumpToVideoPin,
  onStartTimer,
  activeTimer
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (actionFilter !== 'all' && t.action_type !== actionFilter) return false;
    if (onlyMine && t.assigned_to !== currentUser.id && t.status !== 'open') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${t.title} ${t.room} ${t.trade_category} ${t.assignee?.name || ''} ${t.hold_reason_note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: tasks.length,
    open: tasks.filter((t) => t.status === 'open').length,
    accepted: tasks.filter((t) => t.status === 'accepted').length,
    on_hold: tasks.filter((t) => t.status === 'on_hold').length,
    completed: tasks.filter((t) => t.status === 'completed').length
  };

  return (
    <div className="space-y-4">
      {/* Filter & Crew Controls Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isAdmin ? 'Admin & Crew Work Order Board' : `Crew Work Board — ${currentUser.name}`}
            </h2>
            <p className="text-xs text-slate-500">
              Inspect scope & video callouts, accept open tasks, log hours, mark blockers on hold with a reason, or complete work
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="rounded border-slate-300 text-amber-600"
              />
              My Tasks + Open Claims
            </label>
            {isAdmin && (
              <button
                onClick={onOpenNewTask}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Work Order
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Tasks', count: counts.all },
              { id: 'open', label: 'Open / Available', count: counts.open },
              { id: 'accepted', label: 'Accepted · Active', count: counts.accepted },
              { id: 'on_hold', label: 'On Hold', count: counts.on_hold },
              { id: 'completed', label: 'Completed', count: counts.completed }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                  statusFilter === pill.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{pill.label}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/10 font-mono text-[10px]">{pill.count}</span>
              </button>
            ))}
          </div>

          {/* Search + Action Type Filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search room, trade, crew..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
            >
              <option value="all">All Actions</option>
              <option value="fix">Fix Only</option>
              <option value="replace">Replace Only</option>
              <option value="update">Update Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">No Matching Tasks</h3>
          <p className="text-xs text-slate-500 mt-1">
            Adjust status filters or create a new renovation task.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((task) => {
            const actionStyle = ACTION_META[task.action_type] || ACTION_META.fix;
            const statusStyle = STATUS_META[task.status] || STATUS_META.open;
            const isTimerRunning = activeTimer?.taskId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => onOpenTask(task)}
                className={`bg-white rounded-2xl border transition shadow-sm hover:shadow-md flex flex-col justify-between cursor-pointer ${
                  task.status === 'on_hold'
                    ? 'border-orange-300 ring-1 ring-orange-200'
                    : isTimerRunning
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-4 space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[11px] font-bold">
                        SEQ #{String(task.sequence_order).padStart(2, '0')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}>
                        {actionStyle.short}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* Title & Room */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                      {task.room} · {task.trade_category} · Phase {task.sequence_phase}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{task.title}</h3>
                  </div>

                  {/* On Hold Reason Callout */}
                  {task.status === 'on_hold' && (
                    <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950">
                      <div className="font-bold text-[11px] text-orange-800 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        Hold Reason: {task.hold_reason_category}
                      </div>
                      <p className="text-[11px] text-orange-900 mt-0.5 line-clamp-2">{task.hold_reason_note}</p>
                    </div>
                  )}

                  {/* Compensation & Time Estimate */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Compensation
                      </div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {task.pay_type === 'fixed'
                          ? `${formatCurrency(task.fixed_pay_amount)} Fixed`
                          : `${formatCurrency(task.effective_hourly_rate)}/hr`}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {task.logged_hours}h logged
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Est. Time
                      </div>
                      <div className="font-mono font-semibold text-slate-800 mt-0.5">
                        {task.est_hours_pro}h Pro · {task.est_hours_skilled}h Skill
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {task.est_hours_diy}h DIY Homeowner
                      </div>
                    </div>
                  </div>

                  {/* Crew Assignee + Video Pin Link */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {task.assignee ? (
                        <>
                          <span
                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: task.assignee.avatar_color }}
                          >
                            {getInitials(task.assignee.name)}
                          </span>
                          <span className="font-medium text-slate-700 truncate">{task.assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Open to claim</span>
                      )}
                    </div>

                    {task.linked_pins?.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToVideoPin(task.linked_pins[0]);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Video className="w-3 h-3 text-amber-600" />
                        {formatTimecode(task.linked_pins[0].timestamp_sec)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Footer Workflow Buttons (See / Accept / Complete / Put On Hold) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl flex flex-wrap items-center justify-between gap-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    {task.status === 'open' && (
                      <button
                        onClick={() => onWorkflowAction(task.id, { action: 'accept' })}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Hand className="w-3.5 h-3.5" /> Accept
                      </button>
                    )}

                    {task.status === 'on_hold' && (
                      <button
                        onClick={() => onWorkflowAction(task.id, { action: 'resume' })}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" /> Resume
                      </button>
                    )}

                    {task.status !== 'completed' && task.status !== 'on_hold' && (
                      <button
                        onClick={() => onOpenHoldModal(task)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-orange-50 text-orange-800 border border-orange-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <PauseCircle className="w-3.5 h-3.5" /> Hold
                      </button>
                    )}

                    {task.status !== 'completed' && (
                      <button
                        onClick={() => onOpenCompleteModal(task)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </button>
                    )}
                  </div>

                  {task.status !== 'completed' && !isTimerRunning && (
                    <button
                      onClick={() => onStartTimer(task)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                      title="Start Live Shift Timer"
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> Timer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
