import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  CheckCircle2,
  Users,
  Plus,
  Trash2,
  Play,
  Edit3,
  X
} from 'lucide-react';
import { formatCurrency, getInitials, STATUS_META } from '../lib/api';

export default function LaborPayoutsView({
  tasks,
  timeLogs,
  crewUsers,
  currentUser,
  onUpdatePayout,
  onLogHours,
  onToggleApproveLog,
  onDeleteLog,
  onCreateCrewUser,
  onUpdateCrewUser,
  onDeleteCrewUser,
  onStartTimer,
  onOpenTask
}) {
  const [subTab, setSubTab] = useState('ledger'); // 'ledger' | 'timesheet' | 'crew'
  const isAdmin = currentUser?.role === 'admin';

  // Quick Time Entry form
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || '');
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || '');
  const [hours, setHours] = useState('3.5');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  // Crew User Modal
  const [editingUser, setEditingUser] = useState(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);

  // Inline fixed payout edit
  const [editingPayoutTaskId, setEditingPayoutTaskId] = useState(null);
  const [draftPayType, setDraftPayType] = useState('fixed');
  const [draftFixedAmount, setDraftFixedAmount] = useState('500');
  const [draftHourlyOverride, setDraftHourlyOverride] = useState('');

  const totalHoursLogged = tasks.reduce((s, t) => s + Number(t.logged_hours || 0), 0);
  const totalHourlyAccrued = tasks
    .filter((t) => t.pay_type === 'hourly')
    .reduce((s, t) => s + Number(t.labor_cost || 0), 0);
  const totalFixedAssigned = tasks
    .filter((t) => t.pay_type === 'fixed')
    .reduce((s, t) => s + Number(t.fixed_pay_amount || 0), 0);
  const totalPaidOrApproved = tasks
    .filter((t) => t.payout_status === 'paid' || t.payout_status === 'approved')
    .reduce((s, t) => s + Number(t.labor_cost || 0), 0);

  async function handleQuickTimeSubmit(e) {
    e.preventDefault();
    const tid = Number(selectedTaskId || tasks[0]?.id);
    if (!tid || !hours || Number(hours) <= 0) return;
    await onLogHours(tid, {
      hours: Number(hours),
      work_date: workDate,
      note: note.trim() || 'Logged field labor hours',
      user_id: isAdmin && selectedUserId ? Number(selectedUserId) : currentUser.id
    });
    setNote('');
  }

  function startInlineEditPayout(task) {
    setEditingPayoutTaskId(task.id);
    setDraftPayType(task.pay_type);
    setDraftFixedAmount(String(task.fixed_pay_amount || 450));
    setDraftHourlyOverride(task.hourly_rate_override != null ? String(task.hourly_rate_override) : '');
  }

  async function saveInlinePayout(task) {
    await onUpdatePayout(task.id, {
      pay_type: draftPayType,
      fixed_pay_amount: draftPayType === 'fixed' ? Number(draftFixedAmount || 0) : 0,
      hourly_rate_override:
        draftPayType === 'hourly' && draftHourlyOverride !== '' ? Number(draftHourlyOverride) : null,
      payout_status: task.payout_status
    });
    setEditingPayoutTaskId(null);
  }

  return (
    <div className="space-y-5">
      {/* Top Compensation Summary Cards */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Crew Hours Worked</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalHoursLogged.toFixed(1)} hrs
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{timeLogs.length} recorded shift entries</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-blue-700">Hourly Labor Accrued</div>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1 tabular-nums">
            {formatCurrency(totalHourlyAccrued)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {tasks.filter((t) => t.pay_type === 'hourly').length} hourly-tracked tasks
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-amber-700">Fixed-Bid Task Payouts</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
            {formatCurrency(totalFixedAssigned)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {tasks.filter((t) => t.pay_type === 'fixed').length} flat-amount tasks assigned
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-emerald-700">Approved & Paid Out</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {formatCurrency(totalPaidOrApproved)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Total committed: {formatCurrency(totalHourlyAccrued + totalFixedAssigned)}
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ledger', label: 'Task Payouts (Hourly vs. Fixed $)', icon: DollarSign },
            { id: 'timesheet', label: `Crew Hours Log (${timeLogs.length})`, icon: Clock },
            { id: 'crew', label: `Crew Roster & Rates (${crewUsers.length})`, icon: Users }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'crew' && isAdmin && (
          <button
            onClick={() => setShowNewUserModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Crew Member
          </button>
        )}
      </div>

      {/* TAB 1: TASK PAYOUTS LEDGER */}
      {subTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Task Compensation Structure — Hourly Tracking vs. Fixed Task Payouts
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'Assign a flat payout amount per task or pay hourly based on logged crew hours; approve & mark payouts paid.'
                  : 'View hourly rate accrual and fixed completion payouts across project tasks.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/40">
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Crew Assignee</th>
                  <th className="py-3 px-4">Pay Structure</th>
                  <th className="py-3 px-4">Hours Worked</th>
                  <th className="py-3 px-4">Total Payout</th>
                  <th className="py-3 px-4">Payout Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Admin Controls</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tasks.map((task) => {
                  const isEditingThis = editingPayoutTaskId === task.id;
                  const statusMeta = STATUS_META[task.status] || STATUS_META.open;
                  const effectiveFixedRate =
                    task.pay_type === 'fixed' && task.logged_hours > 0
                      ? (task.fixed_pay_amount / task.logged_hours).toFixed(0)
                      : null;

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 max-w-xs">
                        <button
                          onClick={() => onOpenTask(task)}
                          className="font-bold text-slate-900 hover:text-amber-700 text-left block"
                        >
                          #{task.sequence_order} {task.title}
                        </button>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${statusMeta.bg} ${statusMeta.text}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {task.assignee ? (
                          <div className="font-medium text-slate-800">{task.assignee.name}</div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditingThis ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <select
                              value={draftPayType}
                              onChange={(e) => setDraftPayType(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                            >
                              <option value="hourly">Hourly Rate ($/hr)</option>
                              <option value="fixed">Fixed Task Amount ($)</option>
                            </select>
                            {draftPayType === 'fixed' ? (
                              <input
                                type="number"
                                step="10"
                                value={draftFixedAmount}
                                onChange={(e) => setDraftFixedAmount(e.target.value)}
                                placeholder="Fixed $ Amount"
                                className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                              />
                            ) : (
                              <input
                                type="number"
                                step="1"
                                value={draftHourlyOverride}
                                onChange={(e) => setDraftHourlyOverride(e.target.value)}
                                placeholder="$/hr (blank = crew rate)"
                                className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                              />
                            )}
                          </div>
                        ) : task.pay_type === 'fixed' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-mono font-semibold">
                            Fixed Bid: {formatCurrency(task.fixed_pay_amount)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-mono font-semibold">
                            Hourly @ {formatCurrency(task.effective_hourly_rate)}/hr
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-semibold text-slate-900">{task.logged_hours} hrs</div>
                        {effectiveFixedRate && (
                          <div className="text-[10px] text-slate-400">~${effectiveFixedRate}/hr eff.</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatCurrency(task.labor_cost)}
                      </td>

                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <select
                            value={task.payout_status}
                            onChange={(e) => onUpdatePayout(task.id, { payout_status: e.target.value })}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                              task.payout_status === 'paid'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : task.payout_status === 'approved'
                                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                                  : task.payout_status === 'pending_approval'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <option value="unbilled">Unbilled / Active</option>
                            <option value="pending_approval">Pending Approval</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid Out</option>
                          </select>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold capitalize">
                            {task.payout_status.replace('_', ' ')}
                          </span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          {isEditingThis ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => saveInlinePayout(task)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingPayoutTaskId(null)}
                                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startInlineEditPayout(task)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Set Rate / Fixed $
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CREW HOURS TIMESHEET */}
      {subTab === 'timesheet' && (
        <div className="space-y-4">
          {tasks.length > 0 && (
            <form
              onSubmit={handleQuickTimeSubmit}
              className="bg-white rounded-2xl border border-slate-200 p-4 grid sm:grid-cols-12 gap-2.5 items-end shadow-sm"
            >
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Task Worked On</label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.sequence_order} {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Laborer</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    {crewUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hours</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className={isAdmin ? 'sm:col-span-2' : 'sm:col-span-4'}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Work Shift Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was completed..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Log
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {timeLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No crew work hours logged for this property yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {timeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: log.avatar_color }}
                      >
                        {getInitials(log.user_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900">
                          {log.user_name}{' '}
                          <span className="font-normal text-slate-500">on {log.task_title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <span className="font-mono">{log.work_date}</span>
                          {log.note && <span> — {log.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-slate-900">{log.hours} hrs</div>
                        <div className="text-[11px] text-slate-500">
                          {log.pay_type === 'fixed'
                            ? 'Fixed-bid task'
                            : formatCurrency(log.hours * log.effective_rate)}
                        </div>
                      </div>

                      {isAdmin ? (
                        <button
                          onClick={() => onToggleApproveLog(log)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            log.approved
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {log.approved ? 'Approved' : 'Approve'}
                        </button>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            log.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {log.approved ? 'Approved' : 'Pending'}
                        </span>
                      )}

                      {(isAdmin || log.user_id === currentUser.id) && (
                        <button
                          onClick={() => onDeleteLog(log.id)}
                          className="text-slate-300 hover:text-rose-600"
                          title="Delete Time Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CREW ROSTER & RATES */}
      {subTab === 'crew' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crewUsers.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl text-white font-bold text-sm flex items-center justify-center shrink-0"
                      style={{ backgroundColor: u.avatar_color }}
                    >
                      {getInitials(u.name)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.persona_type}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      u.role === 'admin' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>

                {u.specialty && <p className="text-xs text-slate-600 mt-3">{u.specialty}</p>}

                <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Rate</div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {u.role === 'admin' ? 'Owner/GC' : `$${u.hourly_rate}/h`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Skill</div>
                    <div className="text-xs font-mono font-bold text-slate-900 uppercase">
                      {u.experience_level}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Hours</div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {u.stats?.total_hours || 0}h
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-mono text-[11px] truncate">{u.email}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => onDeleteCrewUser(u.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showNewUserModal || editingUser) && (
        <CrewMemberModal
          initialUser={editingUser}
          onClose={() => {
            setShowNewUserModal(false);
            setEditingUser(null);
          }}
          onSave={async (payload) => {
            if (editingUser) {
              await onUpdateCrewUser(editingUser.id, payload);
            } else {
              await onCreateCrewUser(payload);
            }
            setShowNewUserModal(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}

function CrewMemberModal({ initialUser, onClose, onSave }) {
  const isEdit = Boolean(initialUser);
  const [name, setName] = useState(initialUser?.name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [role, setRole] = useState(initialUser?.role || 'laborer');
  const [personaType, setPersonaType] = useState(initialUser?.persona_type || 'Finish Carpenter & Tile');
  const [experienceLevel, setExperienceLevel] = useState(initialUser?.experience_level || 'skilled');
  const [hourlyRate, setHourlyRate] = useState(initialUser?.hourly_rate ?? 24);
  const [specialty, setSpecialty] = useState(initialUser?.specialty || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        email,
        role,
        persona_type: personaType,
        experience_level: experienceLevel,
        hourly_rate: Number(hourlyRate || 0),
        specialty
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            {isEdit ? 'Edit Crew Member & Pay Rate' : 'Add Laborer / Crew Member'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="crew@plumbline.build"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="laborer">Laborer / Crew</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Tier</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="pro">Licensed Pro</option>
                <option value="skilled">Skilled Handyman</option>
                <option value="diy">Novice / Apprentice</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Trade Role</label>
              <input
                type="text"
                value={personaType}
                onChange={(e) => setPersonaType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hourly Rate ($/hr)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trade Specialties</label>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Drywall, Tile Waterproofing & Cabinetry"
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
              {saving ? 'Saving...' : 'Save Crew Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
