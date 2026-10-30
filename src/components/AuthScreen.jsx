import React, { useState, useEffect } from 'react';
import {
  HardHat,
  Video,
  GitBranch,
  Clock,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Wrench,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { apiFetch, getInitials } from '../lib/api';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loadingDemo, setLoadingDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [email, setEmail] = useState('marcus@plumbline.build');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');
  const [personaType, setPersonaType] = useState('House Flipper & GC');
  const [experienceLevel, setExperienceLevel] = useState('skilled');
  const [hourlyRate, setHourlyRate] = useState('55');
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    apiFetch('/api/auth/demo-accounts')
      .then((res) => setDemoAccounts(res.accounts || []))
      .catch(() => {})
      .finally(() => setLoadingDemo(false));
  }, []);

  async function handleDemoClick(acc) {
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ userId: acc.id })
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        onAuthenticated(res.token, res.user);
      } else {
        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            persona_type: personaType,
            experience_level: experienceLevel,
            hourly_rate: role === 'laborer' ? Number(hourlyRate || 45) : 0,
            specialty
          })
        });
        onAuthenticated(res.token, res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const admins = demoAccounts.filter((a) => a.role === 'admin');
  const laborers = demoAccounts.filter((a) => a.role === 'laborer');

  return (
    <div className="min-h-screen bg-[#121518] text-white flex flex-col lg:flex-row">
      {/* Left Showcase & Instant Demo Personas */}
      <div className="lg:w-[56%] p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/90 bg-gradient-to-br from-[#14181D] via-[#121518] to-[#191E24]">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <HardHat className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">PlumbLine</span>
              <span className="ml-2 text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Field & Rehab OS
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight max-w-xl">
            Video inspection callouts, logical trade sequencing & crew payouts in one workspace.
          </h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
            Built for homeowners, house flippers, and general contractors to pinpoint every{' '}
            <span className="text-rose-400 font-medium">Fix</span>,{' '}
            <span className="text-amber-400 font-medium">Replace</span>, and{' '}
            <span className="text-sky-400 font-medium">Update</span> on video, sequence tasks in proper build order, and track crew hours or fixed bids.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Video, label: 'Spatial Video Pins', sub: 'Timestamped callouts' },
              { icon: GitBranch, label: '8-Phase Sequence', sub: 'Critical-path order' },
              { icon: Clock, label: '3-Tier Estimates', sub: 'DIY · Skilled · Pro' },
              { icon: DollarSign, label: 'Hourly or Fixed Pay', sub: 'Live crew ledger' }
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <item.icon className="w-4 h-4 text-amber-400 mb-1.5" />
                <div className="text-xs font-semibold text-slate-100">{item.label}</div>
                <div className="text-[11px] text-slate-400">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* 1-Click Instant Demo Accounts */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Instant 1-Click Demo Login (Explore Admin vs. Laborer Views)
              </span>
              <span className="text-xs text-slate-500 font-mono">pwd: demo1234</span>
            </div>

            {loadingDemo ? (
              <div className="text-sm text-slate-400 flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading demo crew...
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Administrators (Flipper / Owner / GC)
                  </div>
                  {admins.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDemoClick(acc)}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: acc.avatar_color }}
                        >
                          {getInitials(acc.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{acc.name}</div>
                          <div className="text-xs text-slate-400 truncate">{acc.persona_type}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0 transition" />
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-400" /> Field Crew / Laborers
                  </div>
                  {laborers.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDemoClick(acc)}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: acc.avatar_color }}
                        >
                          {getInitials(acc.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {acc.name}{' '}
                            <span className="text-[11px] font-mono text-emerald-400">${acc.hourly_rate}/hr</span>
                          </div>
                          <div className="text-xs text-slate-400 truncate">{acc.persona_type}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Persistent SQLite Storage · Real H.264 Walkthrough Playback</span>
          <span>Inspired by CompanyCam, Buildertrend, Fieldwire & FlipperForce</span>
        </div>
      </div>

      {/* Right Credentials Form */}
      <div className="lg:w-[44%] bg-[#F6F6F3] text-slate-900 p-6 sm:p-10 lg:p-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jordan Miller"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRole('admin');
                        setPersonaType('House Flipper & GC');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        role === 'admin'
                          ? 'border-amber-600 bg-amber-50/70 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">Administrator</div>
                      <div className="text-[11px] text-slate-500">Owner, Flipper or GC</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRole('laborer');
                        setPersonaType('Skilled Trade Crew');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        role === 'laborer'
                          ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">Laborer / Crew</div>
                      <div className="text-[11px] text-slate-500">Accept & Complete Work</div>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@plumbline.build"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Level</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="diy">DIY / Novice</option>
                    <option value="skilled">Skilled Handyman</option>
                    <option value="pro">Licensed Pro</option>
                  </select>
                </div>
                {role === 'laborer' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hourly Rate ($/hr)</label>
                    <input
                      type="number"
                      min="15"
                      step="1"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Type</label>
                    <select
                      value={personaType}
                      onChange={(e) => setPersonaType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                    >
                      <option value="House Flipper & GC">House Flipper & GC</option>
                      <option value="Homeowner Remodeler">Homeowner Remodeler</option>
                      <option value="General Contractor">General Contractor</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {mode === 'register' && role === 'laborer' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trade Specialty</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Rough Plumbing, Framing & Tile"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In to Workspace' : 'Create Account & Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
