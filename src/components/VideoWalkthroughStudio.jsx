import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Crosshair,
  Plus,
  Upload,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Clock,
  SkipBack,
  SkipForward,
  Video,
  X,
  Edit3,
  Mic,
  MicOff,
  Sparkles,
  Volume2
} from 'lucide-react';
import {
  apiFetch,
  ACTION_META,
  STATUS_META,
  CONSTRUCTION_PHASES,
  TRADE_CATEGORIES,
  formatTimecode,
  formatCurrency
} from '../lib/api';

export default function VideoWalkthroughStudio({
  property,
  walkthroughs,
  tasks,
  currentUser,
  initialFocusPin,
  onClearFocusPin,
  onCreateWalkthrough,
  onDeleteWalkthrough,
  onCreatePin,
  onUpdatePin,
  onDeletePin,
  onVoiceGenerateTasks,
  onOpenTask
}) {
  const videoRef = useRef(null);
  const [selectedWtId, setSelectedWtId] = useState(walkthroughs[0]?.id || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(64);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showAllPins, setShowAllPins] = useState(false);
  const [filterAction, setFilterAction] = useState('all'); // 'all' | 'fix' | 'replace' | 'update'
  const [selectedPinId, setSelectedPinId] = useState(null);

  // Pinning crosshair mode
  const [pinMode, setPinMode] = useState(false);
  const [draftPinCoords, setDraftPinCoords] = useState(null); // { x_pct, y_pct, timestamp_sec }
  const [editingPin, setEditingPin] = useState(null);

  // Upload / Create Walkthrough modal + Voice Auto-Builder modal
  const [showNewWtModal, setShowNewWtModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Keep selectedWtId valid when property changes
  useEffect(() => {
    if (initialFocusPin?.walkthrough_id) {
      setSelectedWtId(initialFocusPin.walkthrough_id);
    } else if (!walkthroughs.some((w) => w.id === selectedWtId)) {
      setSelectedWtId(walkthroughs[0]?.id || null);
    }
  }, [walkthroughs, initialFocusPin]);

  const activeWt = walkthroughs.find((w) => w.id === selectedWtId) || walkthroughs[0] || null;

  // Handle jump-to-pin from Task Drawer or Overview
  useEffect(() => {
    if (initialFocusPin && activeWt && initialFocusPin.walkthrough_id === activeWt.id) {
      const targetSec = Number(initialFocusPin.timestamp_sec || 0);
      if (videoRef.current) {
        videoRef.current.currentTime = targetSec;
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setCurrentTime(targetSec);
      setSelectedPinId(initialFocusPin.id);
      if (onClearFocusPin) onClearFocusPin();
    }
  }, [initialFocusPin, activeWt]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }

  function seekTo(sec, highlightPinId = null) {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(duration || 64, Number(sec)));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    if (highlightPinId) setSelectedPinId(highlightPinId);
  }

  function changeSpeed() {
    const speeds = [0.75, 1, 1.25, 1.5];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }

  function handleVideoCanvasClick(e) {
    if (!pinMode) {
      togglePlay();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x_pct = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y_pct = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setDraftPinCoords({
      x_pct: Math.max(4, Math.min(96, x_pct)),
      y_pct: Math.max(6, Math.min(94, y_pct)),
      timestamp_sec: Number(currentTime.toFixed(1))
    });
    setPinMode(false);
  }

  if (!activeWt) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <Video className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Video Walkthroughs Yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
          Upload an inspection video or select a property walkthrough reel to start pinning Fix, Replace, and Update issues directly on rooms.
        </p>
        {isAdmin && (
          <button
            onClick={() => setShowNewWtModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Add Video Walkthrough
          </button>
        )}
        {showNewWtModal && (
          <NewWalkthroughModal
            propertyId={property.id}
            onClose={() => setShowNewWtModal(false)}
            onSave={onCreateWalkthrough}
          />
        )}
      </div>
    );
  }

  const allPins = activeWt.pins || [];
  const filteredPins =
    filterAction === 'all' ? allPins : allPins.filter((p) => p.action_type === filterAction);

  // Pins visible on video frame right now
  const visibleOverlayPins = filteredPins.filter((p) => {
    if (showAllPins || selectedPinId === p.id) return true;
    return currentTime >= Number(p.timestamp_sec) - 0.6 && currentTime <= Number(p.end_sec || p.timestamp_sec + 8);
  });

  const activeChapter = (activeWt.chapters || []).find(
    (c) => currentTime >= c.start && currentTime < c.end
  );

  return (
    <div className="space-y-4">
      {/* Top Walkthrough Switcher & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {walkthroughs.map((wt) => (
            <button
              key={wt.id}
              onClick={() => {
                setSelectedWtId(wt.id);
                setCurrentTime(0);
                setIsPlaying(false);
                setSelectedPinId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                wt.id === activeWt.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate max-w-[230px]">{wt.title}</span>
              <span className="px-1.5 py-0.5 rounded bg-white/15 font-mono text-[10px]">
                {wt.pins?.length || 0} pins
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowVoiceModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <Mic className="w-3.5 h-3.5" />
            Speak / Auto-Build Tasks
          </button>

          <button
            onClick={() => {
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
                setIsPlaying(false);
              }
              setPinMode((v) => !v);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
              pinMode
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-sm'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {pinMode ? 'Click Spot on Video Frame...' : 'Pin Single Spot'}
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowNewWtModal(true)}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Video
            </button>
          )}

          {isAdmin && walkthroughs.length > 1 && (
            <button
              onClick={() => onDeleteWalkthrough(activeWt.id)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
              title="Delete Walkthrough"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Studio: Video Player + Issue Callouts Inspector */}
      <div className="grid xl:grid-cols-12 gap-4 items-start">
        {/* Left 8 cols: Interactive Video Viewport & Annotated Timeline */}
        <div className="xl:col-span-8 bg-[#121518] rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          {/* Top HUD Strip */}
          <div className="px-4 py-2.5 bg-[#171B20] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-semibold text-white">{activeWt.room_scope}</span>
              {activeChapter && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px]">
                  Zone: {activeChapter.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={showAllPins}
                  onChange={(e) => setShowAllPins(e.target.checked)}
                  className="rounded border-slate-600 text-amber-500 bg-slate-800"
                />
                Show all {filteredPins.length} pins at once
              </label>
              <span className="font-mono text-amber-400 font-semibold tabular-nums">
                {formatTimecode(currentTime)} / {formatTimecode(duration)}
              </span>
            </div>
          </div>

          {/* Interactive Video Frame + Spatial Hotspot Overlay (Supports both 16:9 Landscape & 9:16 Vertical Phone Videos!) */}
          <div className="bg-black flex items-center justify-center relative overflow-hidden">
            {pinMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-2 pointer-events-none whitespace-nowrap">
                <Crosshair className="w-4 h-4" />
                Click directly on the issue in your video (@ {formatTimecode(currentTime)})
              </div>
            )}

            <div
              onClick={handleVideoCanvasClick}
              className={`relative bg-black select-none ${
                isPortrait ? 'h-[540px] max-w-full aspect-[9/16]' : 'w-full aspect-video'
              } ${pinMode ? 'cursor-crosshair ring-4 ring-inset ring-amber-400/80' : 'cursor-pointer'}`}
            >
              <video
                ref={videoRef}
                key={activeWt.video_url}
                src={activeWt.video_url}
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setDuration(v.duration || activeWt.duration_sec || 23);
                  setIsPortrait(v.videoHeight > v.videoWidth);
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain pointer-events-none"
              />

            {/* Spatial Issue Hotspot Pins */}
            {visibleOverlayPins.map((pin, idx) => {
              const meta = ACTION_META[pin.action_type] || ACTION_META.fix;
              const isSelected = selectedPinId === pin.id;
              const pinIndex = allPins.findIndex((x) => x.id === pin.id) + 1;
              // Position tooltip smartly so pins near right/bottom edge stay inside viewport
              const tooltipLeft = pin.x_pct > 62 ? 'right-8' : 'left-8';
              const tooltipTop = pin.y_pct > 72 ? 'bottom-0' : 'top-0';

              return (
                <div
                  key={pin.id}
                  style={{ left: `${pin.x_pct}%`, top: `${pin.y_pct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPinId(isSelected ? null : pin.id);
                    if (videoRef.current && !videoRef.current.paused) {
                      videoRef.current.pause();
                      setIsPlaying(false);
                    }
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                >
                  <div
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold font-mono border-2 border-white shadow-lg pin-pulse transition-transform ${
                      meta.pinColor
                    } ${isSelected ? 'scale-125 ring-4 ring-white/50' : 'hover:scale-110'}`}
                  >
                    {pinIndex}
                  </div>

                  {/* Floating Callout Card on video */}
                  <div
                    className={`absolute ${tooltipLeft} ${tooltipTop} w-64 p-3 rounded-xl bg-slate-950/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md transition-opacity ${
                      isSelected || !showAllPins
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${meta.bg} ${meta.text}`}
                      >
                        {meta.short}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {pin.room} · {formatTimecode(pin.timestamp_sec)}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white leading-snug">{pin.title}</div>
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {pin.description}
                    </p>
                    {pin.task_id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const found = tasks.find((t) => t.id === pin.task_id);
                          if (found) onOpenTask(found);
                        }}
                        className="mt-2 w-full py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center justify-between"
                      >
                        <span>Seq #{pin.task_sequence_order}: {pin.task_status?.replace('_', ' ')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chapter Quick-Jump Bar */}
          {activeWt.chapters?.length > 0 && (
            <div className="px-4 pt-3 pb-1 bg-[#161A1F] flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mr-1">Zones:</span>
              {activeWt.chapters.map((ch, idx) => {
                const active = currentTime >= ch.start && currentTime < ch.end;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => seekTo(ch.start + 0.5)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {ch.label} ({formatTimecode(ch.start)})
                  </button>
                );
              })}
            </div>
          )}

          {/* Annotated Defect Timeline Scrubber + Transport Controls */}
          <div className="p-4 bg-[#161A1F] space-y-3">
            {/* Scrubber Track with Issue Markers */}
            <div className="relative pt-3 pb-1">
              <input
                type="range"
                min={0}
                max={duration || 64}
                step={0.1}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              {/* Color-coded Defect Tick Pins above Timeline */}
              <div className="relative h-5 mt-1">
                {filteredPins.map((p) => {
                  const pct = Math.min(98, Math.max(1, (Number(p.timestamp_sec) / (duration || 64)) * 100));
                  const meta = ACTION_META[p.action_type] || ACTION_META.fix;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      style={{ left: `${pct}%` }}
                      onClick={() => seekTo(p.timestamp_sec, p.id)}
                      title={`${formatTimecode(p.timestamp_sec)} — ${meta.short}: ${p.title}`}
                      className={`absolute -translate-x-1/2 top-0 w-3.5 h-3.5 rounded-full ${meta.dot} border-2 border-slate-900 hover:scale-125 transition shadow`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Transport Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Play Walkthrough'}
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(currentTime - 5)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Back 5s"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(currentTime + 5)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Forward 5s"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={changeSpeed}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs"
                >
                  {playbackRate}x
                </button>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Fix
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Replace
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Update
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 cols: Timestamped Known Issues Feed */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col max-h-[680px]">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Walkthrough Known Issues ({filteredPins.length})</h3>
                <p className="text-xs text-slate-500">Click any callout to seek video & inspect task</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'fix', label: 'Fix' },
                { id: 'replace', label: 'Replace' },
                { id: 'update', label: 'Update' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterAction(tab.id)}
                  className={`py-1.5 rounded-lg font-semibold transition ${
                    filterAction === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
            {filteredPins.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No issues in this filter. Click <strong>Pin Issue on Video</strong> to mark a defect at any timestamp.
              </div>
            ) : (
              filteredPins.map((pin) => {
                const meta = ACTION_META[pin.action_type] || ACTION_META.fix;
                const pinNumber = allPins.findIndex((x) => x.id === pin.id) + 1;
                const linkedTask = tasks.find((t) => t.id === pin.task_id);
                const isActiveNow =
                  currentTime >= Number(pin.timestamp_sec) - 0.5 &&
                  currentTime <= Number(pin.end_sec || pin.timestamp_sec + 8);

                return (
                  <div
                    key={pin.id}
                    onClick={() => seekTo(pin.timestamp_sec, pin.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      selectedPinId === pin.id || isActiveNow
                        ? 'border-amber-400 bg-amber-50/40 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${meta.dot}`}
                        >
                          {pinNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {meta.short}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          @{formatTimecode(pin.timestamp_sec)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingPin(pin)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          title="Edit Pin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePin(pin.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete Pin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-1.5 font-semibold text-xs text-slate-900">{pin.title}</div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{pin.description}</p>

                    {linkedTask ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTask(linkedTask);
                        }}
                        className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] hover:text-amber-700"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px]">
                            SEQ #{linkedTask.sequence_order}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${STATUS_META[linkedTask.status]?.bg} ${STATUS_META[linkedTask.status]?.text}`}>
                            {STATUS_META[linkedTask.status]?.label}
                          </span>
                        </div>
                        <span className="font-mono text-slate-500 shrink-0">
                          {linkedTask.est_hours_pro}h Pro · {linkedTask.est_hours_diy}h DIY
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{pin.room} · {pin.severity} severity</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPin(pin);
                          }}
                          className="text-amber-700 font-semibold hover:underline"
                        >
                          Link Task
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal for Creating / Editing a Spatial Issue Pin */}
      {(draftPinCoords || editingPin) && (
        <PinFormModal
          walkthrough={activeWt}
          coords={draftPinCoords}
          existingPin={editingPin}
          propertyTasks={tasks}
          onClose={() => {
            setDraftPinCoords(null);
            setEditingPin(null);
          }}
          onSave={async (payload) => {
            if (editingPin) {
              await onUpdatePin(editingPin.id, payload);
            } else {
              await onCreatePin(activeWt.id, payload);
            }
            setDraftPinCoords(null);
            setEditingPin(null);
          }}
        />
      )}

      {/* Modal for Uploading / Adding a Video Walkthrough */}
      {showNewWtModal && (
        <NewWalkthroughModal
          propertyId={property.id}
          onClose={() => setShowNewWtModal(false)}
          onSave={onCreateWalkthrough}
        />
      )}

      {/* Modal for Voice-to-Tasks Auto-Builder (Mic Dictation OR Video Audio Extraction!) */}
      {showVoiceModal && onVoiceGenerateTasks && (
        <VoiceWalkthroughModal
          walkthrough={activeWt}
          onClose={() => setShowVoiceModal(false)}
          onGenerate={async (payload) => {
            await onVoiceGenerateTasks(activeWt.id, payload);
            setShowVoiceModal(false);
          }}
        />
      )}
    </div>
  );
}

function VoiceWalkthroughModal({ walkthrough, onClose, onGenerate }) {
  const [transcript, setTranscript] = useState('');
  const [room, setRoom] = useState('Kitchen');
  const [listening, setListening] = useState(false);
  const [transcribingMic, setTranscribingMic] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [showFullTabBtn, setShowFullTabBtn] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const gotLiveSpeechRef = useRef(false);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  async function toggleMicrophone() {
    setError('');
    setShowFullTabBtn(false);

    if (listening) {
      setListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      return;
    }

    // Request real microphone access via getUserMedia + MediaRecorder (works across Chrome, Edge, Safari, Firefox!)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone isn’t enabled in this window—click below to open in a full tab or type in the box!');
      if (window.self !== window.top) setShowFullTabBtn(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      gotLiveSpeechRef.current = false;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // If live browser speech didn't already fill text, transcribe via our server's offline Whisper engine!
        if (!gotLiveSpeechRef.current && audioChunksRef.current.length > 0) {
          setTranscribingMic(true);
          try {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const res = await apiFetch('/api/transcribe-audio', {
              method: 'POST',
              body: JSON.stringify({ audio_base64: base64, mime_type: blob.type })
            });
            if (res.text) {
              setTranscript((prev) => (prev ? `${prev.trim()} ${res.text}` : res.text));
            }
          } catch (err) {
            setError(err.message || 'Could not hear speech clearly—try speaking a little closer to your mic!');
          } finally {
            setTranscribingMic(false);
          }
        }
      };

      recorder.start();
      setListening(true);

      // Optional bonus: also run instant browser live speech preview if supported
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = false;
          rec.lang = 'en-US';
          rec.onresult = (event) => {
            let chunk = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                chunk += event.results[i][0].transcript + '. ';
              }
            }
            if (chunk) {
              gotLiveSpeechRef.current = true;
              setTranscript((prev) => (prev ? `${prev.trim()} ${chunk}` : chunk));
            }
          };
          rec.onerror = () => {};
          recognitionRef.current = rec;
          rec.start();
        } catch {}
      }
    } catch (err) {
      setListening(false);
      if (window.self !== window.top) {
        setShowFullTabBtn(true);
        setError(
          'This small preview window blocks microphones for safety — click the button right below to pop your app open in a full browser tab so your mic works!'
        );
      } else {
        setError(
          'Your computer or browser didn’t find an active microphone (or permission was blocked). Check your mic plug/settings or type in the box below!'
        );
      }
    }
  }

  async function handleBuildFromText(e) {
    e.preventDefault();
    if (!transcript.trim()) {
      setError('Say or type what needs to be done in this room first!');
      return;
    }
    setError('');
    setWorking(true);
    try {
      await onGenerate({ mode: 'transcript', transcript: transcript.trim(), default_room: room });
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleExtractFromVideoAudio() {
    setError('');
    setWorking(true);
    try {
      await onGenerate({ mode: 'video_audio', default_room: room });
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg my-auto overflow-hidden">
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Speak Your Walkthrough — Auto-Build Everything!</h3>
              <p className="text-[11px] text-emerald-200">
                No dropdowns! The app picks Fix/Replace/Update, realistic hours, materials, tools & build order for you.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleBuildFromText} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div>{error}</div>
              {showFullTabBtn && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open App in Full Browser Tab (Enables Mic)
                </a>
              )}
            </div>
          )}

          {/* Option A: For future videos where you spoke WHILE recording */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-sky-950">
              <div className="font-bold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-sky-600" /> Did you talk out loud while filming this video?
              </div>
              <div className="text-[11px] text-sky-800 mt-0.5">
                Click here to pull your recorded voice straight out of the video file!
              </div>
            </div>
            <button
              type="button"
              disabled={working}
              onClick={handleExtractFromVideoAudio}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0 disabled:opacity-50"
            >
              {working ? 'Listening to Video...' : 'Pull Voice From Video'}
            </button>
          </div>

          {/* Option B: Silent video? Just talk into Mic OR type plain sentences! */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800">
                Or for a silent video — click Mic to talk (or type in plain English):
              </label>
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  listening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
                {transcribingMic
                  ? 'Turning Voice to Words...'
                  : listening
                  ? 'Stop Mic (Done Talking)'
                  : 'Start Microphone'}
              </button>
            </div>

            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder='Just talk or type naturally! Example: "Clear out all the boxes and trash. Prime and paint the stained kitchen ceiling. Replace the old ceiling fan. Re-hang cabinet doors and put down vinyl plank flooring."'
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Room:</span>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={working}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {working ? 'Building Tasks...' : 'Auto-Build Tasks Now'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PinFormModal({ walkthrough, coords, existingPin, propertyTasks, onClose, onSave }) {
  const isEdit = Boolean(existingPin);
  const [spokenNote, setSpokenNote] = useState(existingPin?.title || '');
  const [room, setRoom] = useState(existingPin?.room || 'Kitchen');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [listening, setListening] = useState(false);

  // Smart auto-filled fields (automatically updated whenever spokenNote changes!)
  const [actionType, setActionType] = useState(existingPin?.action_type || 'fix');
  const [severity, setSeverity] = useState(existingPin?.severity || 'medium');
  const [timestampSec, setTimestampSec] = useState(existingPin?.timestamp_sec ?? coords?.timestamp_sec ?? 0);
  const [tradeCategory, setTradeCategory] = useState('General Carpentry');
  const [sequencePhase, setSequencePhase] = useState(6);
  const [estPro, setEstPro] = useState('1.0');
  const [estSkilled, setEstSkilled] = useState('1.5');
  const [estDiy, setEstDiy] = useState('2.5');
  const [previewMats, setPreviewMats] = useState([]);
  const [saving, setSaving] = useState(false);

  // Live smart estimation as user speaks or types!
  useEffect(() => {
    if (isEdit || !spokenNote.trim() || spokenNote.trim().length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/estimate-text', {
          method: 'POST',
          body: JSON.stringify({ text: spokenNote, room })
        });
        if (res.estimate) {
          setActionType(res.estimate.action_type);
          setSeverity(res.estimate.severity);
          setTradeCategory(res.estimate.trade_category);
          setSequencePhase(res.estimate.sequence_phase);
          setEstPro(String(res.estimate.est_hours_pro));
          setEstSkilled(String(res.estimate.est_hours_skilled));
          setEstDiy(String(res.estimate.est_hours_diy));
          setPreviewMats(res.estimate.materials || []);
        }
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [spokenNote, room, isEdit]);

  function startOneShotMic() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const txt = e.results?.[0]?.[0]?.transcript || '';
      if (txt) setSpokenNote((prev) => (prev ? `${prev} ${txt}` : txt));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!spokenNote.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: spokenNote.trim(),
        description: `Walkthrough callout: "${spokenNote.trim()}"`,
        room: room.trim() || 'Kitchen',
        action_type: actionType,
        severity,
        timestamp_sec: Number(timestampSec),
        end_sec: Number(timestampSec) + 8,
        x_pct: existingPin?.x_pct ?? coords?.x_pct ?? 50,
        y_pct: existingPin?.y_pct ?? coords?.y_pct ?? 50,
        auto_create_task: !isEdit,
        trade_category: tradeCategory,
        sequence_phase: Number(sequencePhase),
        est_hours_pro: Number(estPro),
        est_hours_skilled: Number(estSkilled),
        est_hours_diy: Number(estDiy),
        pay_type: 'hourly',
        fixed_pay_amount: Math.round(Number(estSkilled) * 25)
      });
    } finally {
      setSaving(false);
    }
  }

  const actionMeta = ACTION_META[actionType] || ACTION_META.fix;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md my-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {isEdit ? 'Edit Pin' : `What needs doing here? (@ ${formatTimecode(timestampSec)})`}
            </h3>
            <p className="text-xs text-slate-500">
              Just describe it in plain words—the app fills in the rest automatically!
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800">Say or type what needs to be done *</label>
              <button
                type="button"
                onClick={startOneShotMic}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                  listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Mic className="w-3 h-3 text-amber-600" />
                {listening ? 'Listening...' : 'Speak'}
              </button>
            </div>
            <input
              type="text"
              required
              autoFocus
              value={spokenNote}
              onChange={(e) => setSpokenNote(e.target.value)}
              placeholder='e.g. "Prime and paint stained ceiling" or "Replace ceiling fan"'
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          {/* Automatic Smart Estimate Card (Zero Guessing!) */}
          {!isEdit && spokenNote.trim().length >= 3 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Auto-Estimated For You:
                </span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${actionMeta.bg} ${actionMeta.text}`}>
                  {actionMeta.label} · Phase {sequencePhase}
                </span>
              </div>
              <div className="font-mono text-slate-800 font-semibold">
                Time: {estPro}h Pro · {estSkilled}h Helper · {estDiy}h DIY
              </div>
              {previewMats.length > 0 && (
                <div className="text-[11px] text-slate-600">
                  Materials auto-added: {previewMats.map((m) => m.name).join(', ')}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            {showAdvanced ? 'Hide manual tweaks' : 'Want to tweak hours or category manually?'}
          </button>

          {showAdvanced && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Action</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="fix">Fix / Repair</option>
                    <option value="replace">Replace</option>
                    <option value="update">Update / Modernize</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Room</label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Pro Hrs</label>
                  <input
                    type="number"
                    step="0.25"
                    value={estPro}
                    onChange={(e) => setEstPro(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Helper Hrs</label>
                  <input
                    type="number"
                    step="0.25"
                    value={estSkilled}
                    onChange={(e) => setEstSkilled(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">DIY Hrs</label>
                  <input
                    type="number"
                    step="0.25"
                    value={estDiy}
                    onChange={(e) => setEstDiy(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          )}

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
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Pin & Auto-Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewWalkthroughModal({ propertyId, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [roomScope, setRoomScope] = useState('Kitchen Walkthrough');
  const [summary, setSummary] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [videoPreset, setVideoPreset] = useState('/media/videos/full_house_walkthrough.mp4');
  const [videoFile, setVideoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('property_id', String(propertyId));
      fd.append('title', title.trim());
      fd.append('room_scope', roomScope);
      fd.append('summary', summary);
      if (videoFile) {
        fd.append('video', videoFile);
      } else if (sharedUrl.trim()) {
        fd.append('shared_video_url', sharedUrl.trim());
      } else {
        fd.append('video_url_preset', videoPreset);
        fd.append('duration_sec', videoPreset.includes('full_house') ? '64' : '32');
      }
      await onSave(fd);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Upload or Add Video Walkthrough</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Walkthrough Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Post-Demo Rough-In Plumbing Inspection"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Rooms / Zones Covered</label>
            <input
              type="text"
              value={roomScope}
              onChange={(e) => setRoomScope(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Option 1: Paste Shared Video Link (Google Photos, Google Drive, or .mp4 URL)
            </label>
            <input
              type="url"
              value={sharedUrl}
              onChange={(e) => setSharedUrl(e.target.value)}
              placeholder="https://photos.app.goo.gl/..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Option 2: Or Upload Video File (.mp4, .webm, .mov)
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
            />
          </div>

          {!videoFile && !sharedUrl.trim() && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Or Choose Captured Site Footage Reel
              </label>
              <select
                value={videoPreset}
                onChange={(e) => setVideoPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="/media/videos/full_house_walkthrough.mp4">
                  Full 4-Zone Property Tour (01:04 — Basement, Deck, Kitchen, Bath)
                </option>
                <option value="/media/videos/kitchen_bath_walkthrough.mp4">
                  Kitchen & Primary Bath Wet-Wall Tour (00:32)
                </option>
                <option value="/media/videos/structural_exterior_walkthrough.mp4">
                  Exterior Deck, Gutter & Basement Panel Tour (00:32)
                </option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Inspection Summary</label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Overview notes for crew & contractors..."
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
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              {saving ? 'Uploading...' : 'Create Walkthrough'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
