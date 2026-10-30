const TOKEN_KEY = 'plumbline_auth_token';
let memoryToken = null;

export function getStoredToken() {
  if (memoryToken) return memoryToken;
  try {
    const t = window.localStorage.getItem(TOKEN_KEY);
    if (t) memoryToken = t;
    return t;
  } catch {
    return memoryToken;
  }
}

export function setStoredToken(token) {
  memoryToken = token || null;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage restriction in cross-origin preview iframes; memoryToken remains active
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = { ...(options.headers || {}) };
  let url = endpoint;
  if (token) {
    headers['X-Plumbline-Token'] = token;
    const sep = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${sep}_tok=${encodeURIComponent(token)}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const CONSTRUCTION_PHASES = [
  {
    phase: 1,
    name: 'Safety, Permits & Selective Demo',
    short: 'Phase 1 · Demo',
    rule: 'Strip damaged finishes and open wet walls first to expose hidden rot or hazards before rough trades arrive.'
  },
  {
    phase: 2,
    name: 'Structural, Foundation & Dry-In Envelope',
    short: 'Phase 2 · Structure & Envelope',
    rule: 'Stop exterior water intrusion, secure framing/ledgers, and seal foundation cracks before interior build-back.'
  },
  {
    phase: 3,
    name: 'Rough-In MEP (Plumbing, Electrical, HVAC)',
    short: 'Phase 3 · Rough MEP',
    rule: 'Run rigid gravity drain stacks first, supply lines second, and electrical wiring third while studs are open.'
  },
  {
    phase: 4,
    name: 'Municipal Inspections & Insulation',
    short: 'Phase 4 · Inspect & Insulate',
    rule: 'Pass pressure/rough electrical inspections and install baffles/insulation before hanging wallboard.'
  },
  {
    phase: 5,
    name: 'Drywall Hang, Tape, Mud & Prime',
    short: 'Phase 5 · Drywall & Prime',
    rule: 'Close ceilings before walls, sand dust clean, and seal with PVA/stain-blocking primer before finish work.'
  },
  {
    phase: 6,
    name: 'Waterproofing, Tile & Cabinetry',
    short: 'Phase 6 · Tile & Cabinets',
    rule: 'Waterproof wet zones, set porcelain tile, and laser-level kitchen/bath cabinetry before templating tops.'
  },
  {
    phase: 7,
    name: 'Paint, Flooring & Countertops',
    short: 'Phase 7 · Paint & Floors',
    rule: 'Spray/roll finish coats, template/set stone countertops, and click continuous LVP/hardwood flooring.'
  },
  {
    phase: 8,
    name: 'Finish Fixtures, Trim & Punch Walkthrough',
    short: 'Phase 8 · Final Trim & Punch',
    rule: 'Set toilets, faucets, appliances, switch plates, and verify zero defects in final walkthrough.'
  }
];

export const ACTION_META = {
  fix: {
    label: 'Fix / Repair',
    short: 'FIX',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-600',
    pinColor: 'text-rose-600 bg-rose-600'
  },
  replace: {
    label: 'Replace',
    short: 'REPLACE',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    pinColor: 'text-amber-500 bg-amber-500'
  },
  update: {
    label: 'Update / Modernize',
    short: 'UPDATE',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-600',
    pinColor: 'text-sky-600 bg-sky-600'
  }
};

export const STATUS_META = {
  open: {
    label: 'Open / Available',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200'
  },
  accepted: {
    label: 'Accepted · In Progress',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200'
  },
  on_hold: {
    label: 'On Hold',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-300'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200'
  }
};

export const EXPERIENCE_META = {
  diy: {
    label: 'DIY / Homeowner',
    short: 'DIY Novice',
    field: 'est_hours_diy',
    desc: 'Includes setup, tutorial lookup & careful measurement margin'
  },
  skilled: {
    label: 'Skilled Handyman',
    short: 'Skilled Crew',
    field: 'est_hours_skilled',
    desc: 'Experienced multi-trade rehabber with standard power tools'
  },
  pro: {
    label: 'Licensed Pro Trade',
    short: 'Licensed Pro',
    field: 'est_hours_pro',
    desc: 'Dedicated trade specialist with commercial tooling'
  }
};

export const HOLD_REASON_CATEGORIES = [
  'Hidden Damage / Hazard',
  'Permit / Inspection Hold',
  'Materials Backordered / Missing',
  'Waiting on Prerequisite Trade',
  'Owner / Scope Decision Needed',
  'Utility Shutoff Required'
];

export const TRADE_CATEGORIES = [
  'Demolition',
  'Structural & Foundation',
  'Structural & Framing',
  'Exterior & Roofing',
  'Rough Plumbing',
  'Rough Electrical',
  'HVAC & Ventilation',
  'Drywall & Waterproofing',
  'Tile & Flooring',
  'Cabinetry & Finish',
  'Finish Plumbing & Trim',
  'Paint & Exterior Finish'
];

export function formatCurrency(num) {
  const n = Number(num || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2
  }).format(n);
}

export function formatTimecode(sec) {
  const s = Math.max(0, Math.floor(Number(sec || 0)));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function formatStopwatch(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
