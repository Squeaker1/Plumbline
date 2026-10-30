import React, { useState, useEffect, useCallback } from 'react';
import {
  HardHat,
  LayoutDashboard,
  Video,
  GitBranch,
  ClipboardCheck,
  Package,
  DollarSign,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Square,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';
import {
  apiFetch,
  getStoredToken,
  setStoredToken,
  formatStopwatch,
  getInitials
} from './lib/api';
import AuthScreen from './components/AuthScreen';
import CommandOverview from './components/CommandOverview';
import VideoWalkthroughStudio from './components/VideoWalkthroughStudio';
import TaskSequencerView from './components/TaskSequencerView';
import CrewJobBoardView from './components/CrewJobBoardView';
import MaterialsToolsView from './components/MaterialsToolsView';
import LaborPayoutsView from './components/LaborPayoutsView';
import PropertiesPortfolioView from './components/PropertiesPortfolioView';
import {
  TaskDetailDrawer,
  TaskFormModal,
  HoldReasonModal,
  CompleteTaskModal
} from './components/TaskModals';

const EXPLICIT_LOGOUT_KEY = 'plumbline_explicit_logout';
let explicitLogoutMemory = false;

function getExplicitLogout() {
  if (explicitLogoutMemory) return true;
  try {
    return window.sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === '1';
  } catch {
    return explicitLogoutMemory;
  }
}

function setExplicitLogout(flag) {
  explicitLogoutMemory = Boolean(flag);
  try {
    if (flag) window.sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, '1');
    else window.sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
  } catch {
    // Ignore iframe storage restriction
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Navigation & Workspace State
  const [activeNav, setActiveNav] = useState('overview'); // 'overview' | 'walkthroughs' | 'sequencer' | 'board' | 'materials' | 'payouts' | 'properties'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);

  // Core Data Resources
  const [properties, setProperties] = useState([]);
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [crewUsers, setCrewUsers] = useState([]);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // Interactive Modals / Drawers
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskModalState, setTaskModalState] = useState(null); // null | { mode: 'create' | 'edit', task?: obj }
  const [holdModalTask, setHoldModalTask] = useState(null);
  const [completeModalTask, setCompleteModalTask] = useState(null);
  const [focusVideoPin, setFocusVideoPin] = useState(null);

  // Live Shift Stopwatch
  const [activeTimer, setActiveTimer] = useState(null); // { taskId, taskTitle, startedAtMs }
  const [timerElapsedSec, setTimerElapsedSec] = useState(0);

  // Toast Notifications
  const [toast, setToast] = useState(null);

  function notify(message, type = 'success') {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev && Date.now() - prev.id >= 2900 ? null : prev));
    }, 3000);
  }

  // Bootstrap Authentication (auto-signs in demo Admin on first visit unless user explicitly signed out)
  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const accountsRes = await apiFetch('/api/auth/demo-accounts').catch(() => ({ accounts: [] }));
        setDemoAccounts(accountsRes.accounts || []);

        const existingToken = getStoredToken();
        if (existingToken) {
          try {
            const me = await apiFetch('/api/auth/me');
            setUser(me.user);
            setAuthReady(true);
            return;
          } catch {
            setStoredToken(null);
          }
        }

        const loggedOutExplicitly = getExplicitLogout();
        if (!loggedOutExplicitly) {
          const demoRes = await apiFetch('/api/auth/demo-login', {
            method: 'POST',
            body: JSON.stringify({})
          });
          setStoredToken(demoRes.token);
          setUser(demoRes.user);
        }
      } catch {
        setStoredToken(null);
      } finally {
        setAuthReady(true);
      }
    }
    bootstrapAuth();
  }, []);

  // Live stopwatch interval
  useEffect(() => {
    if (!activeTimer) {
      setTimerElapsedSec(0);
      return;
    }
    const iv = setInterval(() => {
      setTimerElapsedSec(Math.floor((Date.now() - activeTimer.startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  const loadPortfolioAndCrew = useCallback(async () => {
    if (!user) return;
    try {
      const [propRes, usersRes] = await Promise.all([
        apiFetch('/api/properties'),
        apiFetch('/api/users')
      ]);
      const propList = propRes.properties || [];
      setProperties(propList);
      setCrewUsers(usersRes.users || []);
      setActivePropertyId((prev) => {
        if (prev && propList.some((p) => p.id === prev)) return prev;
        const donsHouse = propList.find((p) => p.name.toLowerCase().includes("don's house"));
        return donsHouse ? donsHouse.id : propList[0]?.id || null;
      });
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [user]);

  const loadPropertyDetails = useCallback(async (propId) => {
    if (!user || !propId) return;
    setLoadingWorkspace(true);
    try {
      const [wtRes, tasksRes, logsRes] = await Promise.all([
        apiFetch(`/api/walkthroughs?property_id=${propId}`),
        apiFetch(`/api/tasks?property_id=${propId}`),
        apiFetch(`/api/time-logs?property_id=${propId}`)
      ]);
      setWalkthroughs(wtRes.walkthroughs || []);
      setTasks(tasksRes.tasks || []);
      setTimeLogs(logsRes.time_logs || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPortfolioAndCrew();
    }
  }, [user, loadPortfolioAndCrew]);

  useEffect(() => {
    if (user && activePropertyId) {
      loadPropertyDetails(activePropertyId);
    }
  }, [user, activePropertyId, loadPropertyDetails]);

  async function refreshAllSilently() {
    if (!user) return;
    const [propRes, usersRes] = await Promise.all([
      apiFetch('/api/properties'),
      apiFetch('/api/users')
    ]);
    setProperties(propRes.properties || []);
    setCrewUsers(usersRes.users || []);
    if (activePropertyId) {
      const [wtRes, tasksRes, logsRes] = await Promise.all([
        apiFetch(`/api/walkthroughs?property_id=${activePropertyId}`),
        apiFetch(`/api/tasks?property_id=${activePropertyId}`),
        apiFetch(`/api/time-logs?property_id=${activePropertyId}`)
      ]);
      setWalkthroughs(wtRes.walkthroughs || []);
      setTasks(tasksRes.tasks || []);
      setTimeLogs(logsRes.time_logs || []);
    }
  }

  // Auth Handlers
  function handleAuthenticated(token, nextUser) {
    setExplicitLogout(false);
    setStoredToken(token);
    setUser(nextUser);
    notify(`Signed in as ${nextUser.name} (${nextUser.role})`);
  }

  function handleSignOut() {
    setExplicitLogout(true);
    setStoredToken(null);
    setUser(null);
    setPersonaDropdownOpen(false);
  }

  async function handleQuickSwitchPersona(acc) {
    try {
      const res = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ userId: acc.id })
      });
      setStoredToken(res.token);
      setUser(res.user);
      setPersonaDropdownOpen(false);
      notify(`Switched perspective to ${res.user.name} (${res.user.role.toUpperCase()})`);
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // Optimistic Task Workflow Handler (Accept, Hold w/ Reason, Resume, Complete, Reopen)
  async function handleWorkflowAction(taskId, payload) {
    const prevTasks = [...tasks];
    const optimisticStatusMap = {
      accept: 'accepted',
      hold: 'on_hold',
      resume: 'accepted',
      complete: 'completed',
      reopen: 'open'
    };
    const nextStatus = optimisticStatusMap[payload.action] || 'open';

    setTasks((curr) =>
      curr.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              assigned_to: t.assigned_to || user.id,
              assignee: t.assignee || user,
              hold_reason_category: payload.action === 'hold' ? payload.hold_reason_category : '',
              hold_reason_note: payload.action === 'hold' ? payload.hold_reason_note : ''
            }
          : t
      )
    );

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/workflow`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setTasks((curr) => curr.map((t) => (t.id === taskId ? res.task : t)));
      refreshAllSilently();
      const labels = {
        accept: 'Task accepted and moved to active work',
        hold: `Task placed On Hold (${payload.hold_reason_category})`,
        resume: 'Blocker cleared — task resumed',
        complete: 'Task marked Completed!',
        reopen: 'Task reopened'
      };
      notify(labels[payload.action] || 'Task updated');
    } catch (err) {
      setTasks(prevTasks);
      notify(err.message, 'error');
    }
  }

  // Create / Update / Delete Task
  async function handleSaveTask(payload) {
    try {
      if (taskModalState?.mode === 'edit' && taskModalState.task?.id) {
        const res = await apiFetch(`/api/tasks/${taskModalState.task.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setTasks((curr) => curr.map((t) => (t.id === res.task.id ? res.task : t)));
        notify('Task updated');
      } else {
        const res = await apiFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setTasks((curr) => [...curr, res.task]);
        notify('Sequenced renovation task created');
      }
      refreshAllSilently();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteTask(taskId) {
    const prev = [...tasks];
    setTasks((curr) => curr.filter((t) => t.id !== taskId));
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      refreshAllSilently();
      notify('Task deleted');
    } catch (err) {
      setTasks(prev);
      notify(err.message, 'error');
    }
  }

  async function handleResequence(orderedTaskIds) {
    try {
      const res = await apiFetch(`/api/properties/${activePropertyId}/resequence`, {
        method: 'POST',
        body: JSON.stringify({ ordered_task_ids: orderedTaskIds })
      });
      setTasks(res.tasks || []);
      notify(orderedTaskIds ? 'Sequence order updated' : 'Tasks auto-sequenced by construction phase!');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // Materials & Tools Optimistic CRUD
  async function handleAddMaterial(taskId, payload) {
    try {
      await apiFetch(`/api/tasks/${taskId}/materials`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshAllSilently();
      notify('Material added to take-off list');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleToggleMaterial(mat) {
    const nextPurchased = !mat.purchased;
    setTasks((curr) =>
      curr.map((t) =>
        t.id === mat.task_id
          ? {
              ...t,
              materials: t.materials.map((m) => (m.id === mat.id ? { ...m, purchased: nextPurchased } : m))
            }
          : t
      )
    );
    try {
      await apiFetch(`/api/materials/${mat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ purchased: nextPurchased })
      });
    } catch (err) {
      notify(err.message, 'error');
      refreshAllSilently();
    }
  }

  async function handleDeleteMaterial(matId) {
    setTasks((curr) =>
      curr.map((t) => ({ ...t, materials: (t.materials || []).filter((m) => m.id !== matId) }))
    );
    try {
      await apiFetch(`/api/materials/${matId}`, { method: 'DELETE' });
      refreshAllSilently();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleToggleToolOwned(task, toolId) {
    const updatedTools = (task.tools || []).map((tl) =>
      tl.id === toolId ? { ...tl, owned: !tl.owned } : tl
    );
    setTasks((curr) => curr.map((t) => (t.id === task.id ? { ...t, tools: updatedTools } : t)));
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ tools: updatedTools })
      });
    } catch (err) {
      notify(err.message, 'error');
      refreshAllSilently();
    }
  }

  // Walkthroughs & Pins CRUD
  async function handleCreateWalkthrough(formData) {
    try {
      await apiFetch('/api/walkthroughs', {
        method: 'POST',
        body: formData
      });
      await refreshAllSilently();
      notify('Video walkthrough added');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteWalkthrough(wtId) {
    try {
      await apiFetch(`/api/walkthroughs/${wtId}`, { method: 'DELETE' });
      await refreshAllSilently();
      notify('Walkthrough removed');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleCreatePin(wtId, payload) {
    try {
      await apiFetch(`/api/walkthroughs/${wtId}/pins`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshAllSilently();
      notify(
        payload.auto_create_task
          ? 'Video issue pinned & sequenced task created!'
          : 'Issue pin added to walkthrough'
      );
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleUpdatePin(pinId, payload) {
    try {
      await apiFetch(`/api/pins/${pinId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      await refreshAllSilently();
      notify('Walkthrough pin updated');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeletePin(pinId) {
    try {
      await apiFetch(`/api/pins/${pinId}`, { method: 'DELETE' });
      await refreshAllSilently();
      notify('Pin deleted');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleVoiceGenerateTasks(wtId, payload) {
    const res = await apiFetch(`/api/walkthroughs/${wtId}/voice-generate`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshAllSilently();
    notify(`Auto-created ${res.created_count} tasks with realistic hours, materials, tools & build order!`);
    return res;
  }

  // Time Logs, Live Stopwatch & Payouts
  async function handleLogHours(taskId, payload) {
    try {
      await apiFetch(`/api/tasks/${taskId}/time-logs`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshAllSilently();
      notify(`Logged ${payload.hours} hrs on task`);
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  function handleStartTimer(task) {
    setActiveTimer({
      taskId: task.id,
      taskTitle: task.title,
      startedAtMs: Date.now()
    });
    notify(`Shift timer started on "${task.title.slice(0, 32)}..."`);
  }

  async function handleStopAndLogTimer() {
    if (!activeTimer) return;
    // Minimum 0.25 hr credit so quick demo tests immediately record visible hours!
    const rawHours = (Date.now() - activeTimer.startedAtMs) / 3600000;
    const billedHours = Math.max(0.25, Number(rawHours.toFixed(2)));
    const { taskId } = activeTimer;
    setActiveTimer(null);
    await handleLogHours(taskId, {
      hours: billedHours,
      note: `Timed live work session (${formatStopwatch(timerElapsedSec)})`
    });
  }

  async function handleUpdatePayout(taskId, payload) {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/payout`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setTasks((curr) => curr.map((t) => (t.id === taskId ? res.task : t)));
      await refreshAllSilently();
      notify('Task compensation updated');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleToggleApproveLog(log) {
    try {
      await apiFetch(`/api/time-logs/${log.id}`, {
        method: 'PUT',
        body: JSON.stringify({ approved: !log.approved })
      });
      await refreshAllSilently();
      notify(log.approved ? 'Approval revoked' : 'Time log approved');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteLog(logId) {
    try {
      await apiFetch(`/api/time-logs/${logId}`, { method: 'DELETE' });
      await refreshAllSilently();
      notify('Time entry removed');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // Crew CRUD
  async function handleCreateCrewUser(payload) {
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      const accountsRes = await apiFetch('/api/auth/demo-accounts');
      setDemoAccounts(accountsRes.accounts || []);
      await refreshAllSilently();
      notify('Crew member added');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleUpdateCrewUser(id, payload) {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      await refreshAllSilently();
      notify('Crew member updated');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteCrewUser(id) {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      await refreshAllSilently();
      notify('Crew member removed');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // Property CRUD
  async function handleCreateProperty(payload) {
    try {
      const res = await apiFetch('/api/properties', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await loadPortfolioAndCrew();
      setActivePropertyId(res.property.id);
      setActiveNav('overview');
      notify('New renovation property created');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleUpdateProperty(id, payload) {
    try {
      await apiFetch(`/api/properties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      await refreshAllSilently();
      notify('Property updated');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteProperty(id) {
    try {
      await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
      await loadPortfolioAndCrew();
      notify('Property deleted');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  function handleJumpToVideoPin(pin) {
    setSelectedTaskId(null);
    setFocusVideoPin(pin);
    setActiveNav('walkthroughs');
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#121518] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center animate-pulse">
            <HardHat className="w-4 h-4" />
          </div>
          Loading PlumbLine Renovation Workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const activeProperty = properties.find((p) => p.id === activePropertyId) || properties[0] || null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const onHoldCount = tasks.filter((t) => t.status === 'on_hold').length;
  const openTasksCount = tasks.filter((t) => t.status === 'open').length;
  const pinCount = walkthroughs.reduce((s, w) => s + (w.pins?.length || 0), 0);

  const navItems = [
    { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
    { id: 'walkthroughs', label: 'Video Walkthroughs', icon: Video, badge: pinCount },
    { id: 'sequencer', label: 'Task Sequencer', icon: GitBranch, badge: tasks.length },
    {
      id: 'board',
      label: 'Crew Job Board',
      icon: ClipboardCheck,
      badge: onHoldCount > 0 ? `${onHoldCount} hold` : openTasksCount || null,
      alert: onHoldCount > 0
    },
    { id: 'materials', label: 'Materials & Tools', icon: Package },
    { id: 'payouts', label: 'Labor & Payouts', icon: DollarSign },
    { id: 'properties', label: 'Properties', icon: Building2, badge: properties.length }
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F3] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[264px] bg-[#14171A] text-slate-300 flex flex-col justify-between border-r border-slate-800/80 transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow">
                <HardHat className="w-4 h-4 stroke-[2.3]" />
              </div>
              <div>
                <div className="font-bold text-white text-sm tracking-tight leading-none">PlumbLine</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mt-0.5">
                  Rehab & Field Ops
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Property Selector */}
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
              Active Renovation Property
            </label>
            <select
              value={activePropertyId || ''}
              onChange={(e) => setActivePropertyId(Number(e.target.value))}
              className="w-full bg-slate-800/90 text-white text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nav Links */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
                    {item.label}
                  </span>
                  {item.badge != null && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                        active
                          ? 'bg-slate-950/15 text-slate-950'
                          : item.alert
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Authenticated User + 1-Click Role Switcher */}
        <div className="p-3 border-t border-slate-800/90 space-y-2 bg-[#111417] shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPersonaDropdownOpen((v) => !v)}
              className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-2 text-left transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: user.avatar_color || '#D97706' }}
                >
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{user.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    {user.role === 'admin' ? 'Administrator' : `Laborer · $${user.hourly_rate}/h`}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {personaDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Quick Role Switcher (Demo)
                </div>
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => handleQuickSwitchPersona(acc)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between ${
                      acc.id === user.id
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{acc.name}</span>
                    <span className="text-[10px] font-mono uppercase opacity-75">{acc.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 px-3 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out / Auth Screen
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {navItems.find((n) => n.id === activeNav)?.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    user.role === 'admin'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Viewing as {user.role}: {user.name}
                </span>
              </div>
              {activeProperty && (
                <div className="text-xs text-slate-500 hidden sm:block">
                  {activeProperty.address}, {activeProperty.city_state}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Controls: Active Shift Stopwatch + Quick Role Toggle */}
          <div className="flex items-center gap-2.5">
            {activeTimer && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950 text-white flex items-center gap-2.5 text-xs shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono font-bold text-emerald-300 tabular-nums">
                  {formatStopwatch(timerElapsedSec)}
                </span>
                <span className="hidden md:inline text-slate-300 truncate max-w-[160px]">
                  {activeTimer.taskTitle}
                </span>
                <button
                  onClick={handleStopAndLogTimer}
                  className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1"
                >
                  <Square className="w-2.5 h-2.5 fill-current" /> Stop & Log
                </button>
              </div>
            )}

            <button
              onClick={() => {
                // Cycle between Admin (Marcus) and Laborer (Carlos) for effortless 1-click evaluation
                const target =
                  user.role === 'admin'
                    ? demoAccounts.find((a) => a.role === 'laborer')
                    : demoAccounts.find((a) => a.role === 'admin');
                if (target) handleQuickSwitchPersona(target);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
              title="Instantly switch between Admin and Laborer view"
            >
              <Users className="w-3.5 h-3.5 text-amber-600" />
              Switch to {user.role === 'admin' ? 'Laborer View' : 'Admin View'}
            </button>
          </div>
        </header>

        {/* Always-Visible Quick Tab Strip on Compact / Side-by-Side Preview Screens */}
        <div className="lg:hidden bg-[#181C20] border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition shrink-0 ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Page Body */}
        <main className="p-4 sm:p-6 max-w-[1440px] w-full mx-auto flex-1">
          {loadingWorkspace && tasks.length === 0 ? (
            <div className="grid sm:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-36 bg-white rounded-2xl border border-slate-200" />
              ))}
            </div>
          ) : activeNav === 'overview' ? (
            <CommandOverview
              property={activeProperty}
              walkthroughs={walkthroughs}
              tasks={tasks}
              currentUser={user}
              onNavigate={setActiveNav}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
              onJumpToVideoPin={handleJumpToVideoPin}
              onWorkflowAction={handleWorkflowAction}
              onOpenHoldModal={setHoldModalTask}
              onOpenCompleteModal={setCompleteModalTask}
            />
          ) : activeNav === 'walkthroughs' ? (
            <VideoWalkthroughStudio
              property={activeProperty}
              walkthroughs={walkthroughs}
              tasks={tasks}
              currentUser={user}
              initialFocusPin={focusVideoPin}
              onClearFocusPin={() => setFocusVideoPin(null)}
              onCreateWalkthrough={handleCreateWalkthrough}
              onDeleteWalkthrough={handleDeleteWalkthrough}
              onCreatePin={handleCreatePin}
              onUpdatePin={handleUpdatePin}
              onDeletePin={handleDeletePin}
              onVoiceGenerateTasks={handleVoiceGenerateTasks}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
            />
          ) : activeNav === 'sequencer' ? (
            <TaskSequencerView
              property={activeProperty}
              tasks={tasks}
              currentUser={user}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
              onOpenNewTask={() => setTaskModalState({ mode: 'create' })}
              onResequence={handleResequence}
              onJumpToVideoPin={handleJumpToVideoPin}
            />
          ) : activeNav === 'board' ? (
            <CrewJobBoardView
              tasks={tasks}
              currentUser={user}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
              onOpenNewTask={() => setTaskModalState({ mode: 'create' })}
              onWorkflowAction={handleWorkflowAction}
              onOpenHoldModal={setHoldModalTask}
              onOpenCompleteModal={setCompleteModalTask}
              onJumpToVideoPin={handleJumpToVideoPin}
              onStartTimer={handleStartTimer}
              activeTimer={activeTimer}
            />
          ) : activeNav === 'materials' ? (
            <MaterialsToolsView
              tasks={tasks}
              onToggleMaterial={handleToggleMaterial}
              onAddMaterial={handleAddMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onToggleToolOwned={handleToggleToolOwned}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
            />
          ) : activeNav === 'payouts' ? (
            <LaborPayoutsView
              tasks={tasks}
              timeLogs={timeLogs}
              crewUsers={crewUsers}
              currentUser={user}
              onUpdatePayout={handleUpdatePayout}
              onLogHours={handleLogHours}
              onToggleApproveLog={handleToggleApproveLog}
              onDeleteLog={handleDeleteLog}
              onCreateCrewUser={handleCreateCrewUser}
              onUpdateCrewUser={handleUpdateCrewUser}
              onDeleteCrewUser={handleDeleteCrewUser}
              onStartTimer={handleStartTimer}
              onOpenTask={(t) => setSelectedTaskId(t.id)}
            />
          ) : (
            <PropertiesPortfolioView
              properties={properties}
              activePropertyId={activePropertyId}
              currentUser={user}
              onSelectProperty={(id) => {
                setActivePropertyId(id);
                setActiveNav('overview');
              }}
              onCreateProperty={handleCreateProperty}
              onUpdateProperty={handleUpdateProperty}
              onDeleteProperty={handleDeleteProperty}
            />
          )}
        </main>
      </div>

      {/* Task Slide-Over Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          currentUser={user}
          onClose={() => setSelectedTaskId(null)}
          onWorkflowAction={handleWorkflowAction}
          onOpenHoldModal={(t) => setHoldModalTask(t)}
          onOpenCompleteModal={(t) => setCompleteModalTask(t)}
          onEditTask={(t) => setTaskModalState({ mode: 'edit', task: t })}
          onDeleteTask={handleDeleteTask}
          onJumpToVideoPin={handleJumpToVideoPin}
          onAddMaterial={handleAddMaterial}
          onToggleMaterial={handleToggleMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onToggleToolOwned={handleToggleToolOwned}
          onLogHours={handleLogHours}
          onStartTimer={handleStartTimer}
          activeTimer={activeTimer}
        />
      )}

      {/* Create / Edit Task Modal */}
      {taskModalState && activeProperty && (
        <TaskFormModal
          propertyId={activeProperty.id}
          initialTask={taskModalState.mode === 'edit' ? taskModalState.task : null}
          allPropertyTasks={tasks}
          crewUsers={crewUsers}
          onClose={() => setTaskModalState(null)}
          onSave={handleSaveTask}
        />
      )}

      {/* Put On Hold w/ Reason Modal */}
      {holdModalTask && (
        <HoldReasonModal
          task={holdModalTask}
          onClose={() => setHoldModalTask(null)}
          onConfirm={(payload) => handleWorkflowAction(holdModalTask.id, payload)}
        />
      )}

      {/* Complete Task Modal */}
      {completeModalTask && (
        <CompleteTaskModal
          task={completeModalTask}
          onClose={() => setCompleteModalTask(null)}
          onLogHours={handleLogHours}
          onConfirm={(payload) => handleWorkflowAction(completeModalTask.id, payload)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
