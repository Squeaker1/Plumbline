import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import db, { initDb } from './db.js';
import { estimateSingleTaskFromSpeech, splitTranscriptIntoStatements } from './estimator.js';

const APP_ROOT = process.cwd();
const PERSISTENT_VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.STORAGE_DIR || '';
const MODELS_CACHE_DIR = PERSISTENT_VOLUME
  ? path.resolve(PERSISTENT_VOLUME, 'models')
  : path.resolve(APP_ROOT, 'data', 'models');
const UPLOAD_MEDIA_ROOT = PERSISTENT_VOLUME
  ? path.resolve(PERSISTENT_VOLUME, 'media')
  : path.resolve(APP_ROOT, 'public', 'media');
const BUNDLED_MEDIA_ROOT = path.resolve(APP_ROOT, 'public', 'media');

function resolveMediaDiskPath(relMedia) {
  const inUpload = path.resolve(UPLOAD_MEDIA_ROOT, relMedia);
  if (fs.existsSync(inUpload)) return inUpload;
  return path.resolve(BUNDLED_MEDIA_ROOT, relMedia);
}

let whisperTranscriberPromise = null;
async function transcribeVideoFileWithWhisper(videoDiskPath) {
  const { pipeline, env } = await import('@huggingface/transformers');
  const ffmpegMod = await import('ffmpeg-static');
  const wavefileMod = await import('wavefile');
  const ffmpegPath = ffmpegMod.default || ffmpegMod;
  const WaveFile = wavefileMod.default?.WaveFile || wavefileMod.WaveFile;

  fs.mkdirSync(MODELS_CACHE_DIR, { recursive: true });
  env.cacheDir = MODELS_CACHE_DIR;
  const wavPath = `/tmp/wt_audio_${Date.now()}.wav`;
  try {
    execFileSync(
      ffmpegPath,
      ['-y', '-i', videoDiskPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath],
      { stdio: 'ignore' }
    );
  } catch {
    throw new Error('This video does not appear to have a spoken audio track. Use the "Talk Over Video" mic button instead!');
  }

  try {
    const buf = fs.readFileSync(wavPath);
    const wav = new WaveFile(buf);
    wav.toBitDepth('32f');
    let samples = wav.getSamples();
    if (Array.isArray(samples)) samples = samples[0];

    if (!whisperTranscriberPromise) {
      whisperTranscriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        dtype: 'q8'
      });
    }
    const transcriber = await whisperTranscriberPromise;
    const out = await transcriber(samples, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5
    });
    return out;
  } finally {
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  }
}

initDb();

const JWT_SECRET = process.env.JWT_SECRET || 'plumbline-renovation-secret-key-2026';
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure upload directories exist (persists inside Railway Volume when mounted!)
const videosDir = path.resolve(UPLOAD_MEDIA_ROOT, 'videos');
fs.mkdirSync(videosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Serve static media with Range support for smooth <video> timeline scrubbing
app.use('/media', express.static(UPLOAD_MEDIA_ROOT, {
  acceptRanges: true,
  maxAge: '1h'
}));
if (UPLOAD_MEDIA_ROOT !== BUNDLED_MEDIA_ROOT) {
  app.use('/media', express.static(BUNDLED_MEDIA_ROOT, {
    acceptRanges: true,
    maxAge: '1h'
  }));
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: '14d'
  });
}

function requireAuth(req, res, next) {
  const customToken = req.headers['x-plumbline-token'] || req.query?._tok;
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = customToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(String(token), JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required for this action' });
  }
  next();
}

// Helper to compute task financials & enrich task object
function enrichTasks(rawTasks) {
  if (!rawTasks.length) return [];
  const usersMap = new Map(
    db.prepare('SELECT id, name, email, role, persona_type, experience_level, hourly_rate, specialty, avatar_color FROM users').all().map((u) => [u.id, u])
  );
  const allMaterials = db.prepare('SELECT * FROM task_materials ORDER BY id ASC').all();
  const allLogs = db.prepare(`
    SELECT tl.*, u.name as user_name, u.avatar_color, u.hourly_rate as user_hourly_rate
    FROM time_logs tl
    JOIN users u ON u.id = tl.user_id
    ORDER BY tl.work_date DESC, tl.id DESC
  `).all();
  const allPins = db.prepare(`
    SELECT wp.*, w.title as walkthrough_title, w.video_url
    FROM walkthrough_pins wp
    JOIN walkthroughs w ON w.id = wp.walkthrough_id
  `).all();

  const statusById = new Map(rawTasks.map((t) => [t.id, t.status]));
  // In case rawTasks is filtered, also check property task statuses
  const allTaskStatusRows = db.prepare('SELECT id, title, sequence_order, status FROM tasks').all();
  const globalTaskMap = new Map(allTaskStatusRows.map((r) => [r.id, r]));

  return rawTasks.map((t) => {
    const assignee = t.assigned_to ? usersMap.get(t.assigned_to) || null : null;
    const materials = allMaterials.filter((m) => m.task_id === t.id).map((m) => ({
      ...m,
      purchased: Boolean(m.purchased)
    }));
    const timeLogs = allLogs.filter((l) => l.task_id === t.id).map((l) => ({
      ...l,
      approved: Boolean(l.approved)
    }));
    const linkedPins = allPins.filter((p) => p.task_id === t.id);

    let dependsOn = [];
    try {
      dependsOn = JSON.parse(t.depends_on_json || '[]');
    } catch {
      dependsOn = [];
    }

    let tools = [];
    try {
      tools = JSON.parse(t.tools_json || '[]');
    } catch {
      tools = [];
    }

    const prerequisiteTasks = dependsOn
      .map((depId) => globalTaskMap.get(Number(depId)))
      .filter(Boolean);
    const blockingTasks = prerequisiteTasks.filter((pt) => pt.status !== 'completed');

    const loggedHours = timeLogs.reduce((sum, l) => sum + Number(l.hours || 0), 0);
    const effectiveRate =
      t.hourly_rate_override != null && t.hourly_rate_override !== ''
        ? Number(t.hourly_rate_override)
        : assignee?.hourly_rate || 25;

    const laborCost =
      t.pay_type === 'fixed'
        ? Number(t.fixed_pay_amount || 0)
        : Number((loggedHours * effectiveRate).toFixed(2));

    const estimatedLaborCost =
      t.pay_type === 'fixed'
        ? Number(t.fixed_pay_amount || 0)
        : Number(((assignee?.experience_level === 'diy' ? t.est_hours_diy : assignee?.experience_level === 'skilled' ? t.est_hours_skilled : t.est_hours_pro) * effectiveRate).toFixed(2));

    const materialsCost = Number(
      materials.reduce((sum, m) => sum + Number(m.quantity || 0) * Number(m.unit_cost || 0), 0).toFixed(2)
    );

    return {
      ...t,
      depends_on: dependsOn,
      prerequisite_tasks: prerequisiteTasks,
      blocking_tasks: blockingTasks,
      is_blocked: blockingTasks.length > 0 && t.status !== 'completed',
      tools,
      assignee,
      materials,
      time_logs: timeLogs,
      linked_pins: linkedPins,
      logged_hours: Number(loggedHours.toFixed(2)),
      effective_hourly_rate: effectiveRate,
      labor_cost: laborCost,
      estimated_labor_cost: estimatedLaborCost,
      materials_cost: materialsCost
    };
  });
}

// ==========================================
// AUTH ROUTES
// ==========================================
app.get('/api/auth/demo-accounts', (_req, res) => {
  const accounts = db
    .prepare('SELECT id, name, email, role, persona_type, experience_level, hourly_rate, specialty, avatar_color FROM users ORDER BY role ASC, id ASC')
    .all();
  res.json({ accounts });
});

app.post('/api/auth/demo-login', (req, res) => {
  const { email, userId } = req.body || {};
  let user;
  if (userId) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  } else if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } else {
    user = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get();
  }
  if (!user) return res.status(404).json({ error: 'Demo user not found' });
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const {
    name,
    email,
    password,
    role = 'admin',
    persona_type = role === 'admin' ? 'Homeowner / Flipper' : 'Skilled Trade Laborer',
    experience_level = 'skilled',
    hourly_rate = role === 'laborer' ? 48 : 0,
    specialty = ''
  } = req.body || {};

  if (!name?.trim() || !email?.trim() || !password || password.length < 4) {
    return res.status(400).json({ error: 'Name, valid email, and password (4+ chars) are required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
  if (exists) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const colors = ['#D97706', '#0284C7', '#059669', '#7C3AED', '#DC2626', '#0D9488'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];
  const hash = bcrypt.hashSync(password, 10);
  const validRole = role === 'laborer' ? 'laborer' : 'admin';
  const validExp = ['diy', 'skilled', 'pro'].includes(experience_level) ? experience_level : 'skilled';

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, persona_type, experience_level, hourly_rate, specialty, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    email.trim().toLowerCase(),
    hash,
    validRole,
    persona_type,
    validExp,
    Number(hourly_rate || 0),
    specialty,
    avatar_color
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// USERS / CREW MANAGEMENT ROUTES
// ==========================================
app.get('/api/users', requireAuth, (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY role ASC, name ASC').all().map(sanitizeUser);
  const tasks = enrichTasks(db.prepare('SELECT * FROM tasks').all());

  const enriched = users.map((u) => {
    const userTasks = tasks.filter((t) => t.assigned_to === u.id);
    const userLogs = db.prepare('SELECT COALESCE(SUM(hours), 0) as hrs FROM time_logs WHERE user_id = ?').get(u.id);
    const totalEarned = userTasks.reduce((sum, t) => sum + (t.status === 'completed' || t.pay_type === 'hourly' ? t.labor_cost : 0), 0);
    const fixedCommitted = userTasks
      .filter((t) => t.pay_type === 'fixed' && t.status !== 'completed')
      .reduce((sum, t) => sum + Number(t.fixed_pay_amount || 0), 0);

    return {
      ...u,
      stats: {
        assigned_count: userTasks.length,
        completed_count: userTasks.filter((t) => t.status === 'completed').length,
        active_count: userTasks.filter((t) => t.status === 'accepted').length,
        on_hold_count: userTasks.filter((t) => t.status === 'on_hold').length,
        total_hours: Number((userLogs?.hrs || 0).toFixed(2)),
        earned_amount: Number(totalEarned.toFixed(2)),
        committed_fixed_pending: Number(fixedCommitted.toFixed(2))
      }
    };
  });

  res.json({ users: enriched });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const {
    name,
    email,
    password = 'demo1234',
    role = 'laborer',
    persona_type = 'Trade Specialist',
    experience_level = 'skilled',
    hourly_rate = 45,
    specialty = ''
  } = req.body || {};

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
  if (exists) return res.status(409).json({ error: 'Email already in use' });

  const colors = ['#059669', '#0284C7', '#7C3AED', '#DC2626', '#D97706', '#0D9488'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];
  const hash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, persona_type, experience_level, hourly_rate, specialty, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    email.trim().toLowerCase(),
    hash,
    role === 'admin' ? 'admin' : 'laborer',
    persona_type,
    ['diy', 'skilled', 'pro'].includes(experience_level) ? experience_level : 'skilled',
    Number(hourly_rate || 0),
    specialty,
    avatar_color
  );

  const user = sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json({ user });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const {
    name = existing.name,
    role = existing.role,
    persona_type = existing.persona_type,
    experience_level = existing.experience_level,
    hourly_rate = existing.hourly_rate,
    specialty = existing.specialty
  } = req.body || {};

  db.prepare(`
    UPDATE users
    SET name = ?, role = ?, persona_type = ?, experience_level = ?, hourly_rate = ?, specialty = ?
    WHERE id = ?
  `).run(name, role, persona_type, experience_level, Number(hourly_rate || 0), specialty, id);

  const updated = sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  res.json({ user: updated });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your currently active account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// ==========================================
// PROPERTIES / PROJECTS ROUTES
// ==========================================
app.get('/api/properties', requireAuth, (_req, res) => {
  const props = db.prepare('SELECT * FROM properties ORDER BY id ASC').all();
  const allTasks = enrichTasks(db.prepare('SELECT * FROM tasks').all());
  const wtCounts = db.prepare('SELECT property_id, COUNT(*) as c FROM walkthroughs GROUP BY property_id').all();
  const pinCounts = db.prepare('SELECT property_id, COUNT(*) as c FROM walkthrough_pins GROUP BY property_id').all();

  const wtMap = new Map(wtCounts.map((r) => [r.property_id, r.c]));
  const pinMap = new Map(pinCounts.map((r) => [r.property_id, r.c]));

  const enriched = props.map((p) => {
    const pTasks = allTasks.filter((t) => t.property_id === p.id);
    const materialsTotal = pTasks.reduce((s, t) => s + t.materials_cost, 0);
    const laborActualOrFixed = pTasks.reduce((s, t) => s + t.labor_cost, 0);
    const laborEstimatedTotal = pTasks.reduce((s, t) => s + (t.status === 'completed' ? t.labor_cost : Math.max(t.labor_cost, t.estimated_labor_cost)), 0);
    const hoursLogged = pTasks.reduce((s, t) => s + t.logged_hours, 0);

    return {
      ...p,
      metrics: {
        total_tasks: pTasks.length,
        completed_tasks: pTasks.filter((t) => t.status === 'completed').length,
        accepted_tasks: pTasks.filter((t) => t.status === 'accepted').length,
        on_hold_tasks: pTasks.filter((t) => t.status === 'on_hold').length,
        open_tasks: pTasks.filter((t) => t.status === 'open').length,
        fix_count: pTasks.filter((t) => t.action_type === 'fix').length,
        replace_count: pTasks.filter((t) => t.action_type === 'replace').length,
        update_count: pTasks.filter((t) => t.action_type === 'update').length,
        walkthrough_count: wtMap.get(p.id) || 0,
        pin_count: pinMap.get(p.id) || 0,
        materials_cost: Number(materialsTotal.toFixed(2)),
        labor_cost_accrued: Number(laborActualOrFixed.toFixed(2)),
        labor_cost_projected: Number(laborEstimatedTotal.toFixed(2)),
        total_committed_spend: Number((materialsTotal + laborActualOrFixed).toFixed(2)),
        hours_logged: Number(hoursLogged.toFixed(2)),
        est_hours_diy: Number(pTasks.reduce((s, t) => s + Number(t.est_hours_diy || 0), 0).toFixed(1)),
        est_hours_skilled: Number(pTasks.reduce((s, t) => s + Number(t.est_hours_skilled || 0), 0).toFixed(1)),
        est_hours_pro: Number(pTasks.reduce((s, t) => s + Number(t.est_hours_pro || 0), 0).toFixed(1))
      }
    };
  });

  res.json({ properties: enriched });
});

app.post('/api/properties', requireAuth, requireAdmin, (req, res) => {
  const {
    name,
    address,
    city_state = 'Knoxville, TN',
    project_type = 'Fix & Flip',
    status = 'Inspection & Scope',
    sqft = 1800,
    year_built = 1978,
    beds = 3,
    baths = 2,
    purchase_price = 0,
    rehab_budget = 45000,
    arv_estimate = 0,
    target_date = '2026-12-31',
    cover_image = '/media/frames/exterior_deck_roof.jpg',
    notes = ''
  } = req.body || {};

  if (!name?.trim() || !address?.trim()) {
    return res.status(400).json({ error: 'Property name and street address are required' });
  }

  const info = db.prepare(`
    INSERT INTO properties (name, address, city_state, project_type, status, sqft, year_built, beds, baths, purchase_price, rehab_budget, arv_estimate, target_date, cover_image, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    address.trim(),
    city_state,
    project_type,
    status,
    Number(sqft),
    Number(year_built),
    Number(beds),
    Number(baths),
    Number(purchase_price),
    Number(rehab_budget),
    Number(arv_estimate),
    target_date,
    cover_image,
    notes,
    req.user.id
  );

  const created = db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ property: created });
});

app.put('/api/properties/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const {
    name = existing.name,
    address = existing.address,
    city_state = existing.city_state,
    project_type = existing.project_type,
    status = existing.status,
    sqft = existing.sqft,
    year_built = existing.year_built,
    beds = existing.beds,
    baths = existing.baths,
    purchase_price = existing.purchase_price,
    rehab_budget = existing.rehab_budget,
    arv_estimate = existing.arv_estimate,
    target_date = existing.target_date,
    cover_image = existing.cover_image,
    notes = existing.notes
  } = req.body || {};

  db.prepare(`
    UPDATE properties
    SET name = ?, address = ?, city_state = ?, project_type = ?, status = ?, sqft = ?, year_built = ?, beds = ?, baths = ?, purchase_price = ?, rehab_budget = ?, arv_estimate = ?, target_date = ?, cover_image = ?, notes = ?
    WHERE id = ?
  `).run(
    name,
    address,
    city_state,
    project_type,
    status,
    Number(sqft),
    Number(year_built),
    Number(beds),
    Number(baths),
    Number(purchase_price),
    Number(rehab_budget),
    Number(arv_estimate),
    target_date,
    cover_image,
    notes,
    id
  );

  const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  res.json({ property: updated });
});

app.delete('/api/properties/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  res.json({ success: true });
});

// ==========================================
// VIDEO WALKTHROUGHS & SPATIAL ISSUE PINS
// ==========================================
app.get('/api/walkthroughs', requireAuth, (req, res) => {
  const propId = req.query.property_id ? Number(req.query.property_id) : null;
  const rows = propId
    ? db.prepare('SELECT * FROM walkthroughs WHERE property_id = ? ORDER BY id ASC').all(propId)
    : db.prepare('SELECT * FROM walkthroughs ORDER BY id ASC').all();

  const pins = db.prepare(`
    SELECT wp.*, t.title as task_title, t.status as task_status, t.sequence_order as task_sequence_order,
           t.est_hours_diy, t.est_hours_skilled, t.est_hours_pro, t.pay_type, t.fixed_pay_amount
    FROM walkthrough_pins wp
    LEFT JOIN tasks t ON t.id = wp.task_id
    ORDER BY wp.timestamp_sec ASC, wp.id ASC
  `).all();

  const walkthroughs = rows.map((w) => {
    let chapters = [];
    try {
      chapters = JSON.parse(w.chapters_json || '[]');
    } catch {
      chapters = [];
    }
    return {
      ...w,
      chapters,
      pins: pins.filter((p) => p.walkthrough_id === w.id)
    };
  });

  res.json({ walkthroughs });
});

async function downloadSharedVideoUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  let downloadUrl = trimmed;

  // Handle Google Drive share links: https://drive.google.com/file/d/FILE_ID/view
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  } else if (/photos\.app\.goo\.gl|photos\.google\.com/i.test(trimmed)) {
    // Follow Google Photos share redirect and extract raw video stream URL (=dv)
    const pageRes = await fetch(trimmed, {
      redirect: 'follow',
      headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml' }
    });
    const html = await pageRes.text();
    const videoDlMatch = html.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^"'\s\\]+/);
    const lh3Match =
      html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_-]+/) ||
      html.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_-]{30,}/);

    if (videoDlMatch) {
      downloadUrl = videoDlMatch[0].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    } else if (lh3Match) {
      downloadUrl = `${lh3Match[0]}=m22`;
    } else {
      throw new Error(
        'Google Photos hid the direct video stream on this link. In Google Photos, click the 3 dots (top-right) -> Download, then use Choose File!'
      );
    }
  }

  const vidRes = await fetch(downloadUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': ua }
  });
  if (!vidRes.ok) {
    throw new Error(`Could not download shared video (HTTP ${vidRes.status}). Try downloading it first and clicking Choose File.`);
  }
  const contentType = vidRes.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      'That link opened a web page instead of a raw video file. In Google Photos, click the 3 dots (top-right) -> Download, then pick it with Choose File!'
    );
  }

  const outName = `${Date.now()}_shared_walkthrough.mp4`;
  const outPath = path.join(videosDir, outName);
  const arrayBuf = await vidRes.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  return `/media/videos/${outName}`;
}

app.post('/api/walkthroughs', requireAuth, requireAdmin, upload.single('video'), async (req, res) => {
  try {
    const {
      property_id,
      title,
      room_scope = 'Interior & Exterior',
      video_url_preset,
      shared_video_url,
      thumbnail_url = '/media/frames/kitchen_inspection.jpg',
      duration_sec = 32,
      summary = '',
      chapters_json = '[]'
    } = req.body || {};

    if (!property_id || !title?.trim()) {
      return res.status(400).json({ error: 'Property and walkthrough title are required' });
    }

    let videoUrl = '/media/videos/full_house_walkthrough.mp4';
    if (req.file) {
      videoUrl = `/media/videos/${req.file.filename}`;
    } else if (shared_video_url && String(shared_video_url).trim()) {
      videoUrl = await downloadSharedVideoUrl(shared_video_url);
    } else if (video_url_preset) {
      videoUrl = video_url_preset;
    }

    const info = db.prepare(`
      INSERT INTO walkthroughs (property_id, title, room_scope, video_url, thumbnail_url, duration_sec, recorded_by, summary, chapters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(property_id),
      title.trim(),
      room_scope,
      videoUrl,
      thumbnail_url,
      Number(duration_sec || 32),
      req.user.name,
      summary,
      typeof chapters_json === 'string' ? chapters_json : JSON.stringify(chapters_json)
    );

    const created = db.prepare('SELECT * FROM walkthroughs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      walkthrough: {
        ...created,
        chapters: JSON.parse(created.chapters_json || '[]'),
        pins: []
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add walkthrough video' });
  }
});

app.put('/api/walkthroughs/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM walkthroughs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Walkthrough not found' });

  const {
    title = existing.title,
    room_scope = existing.room_scope,
    summary = existing.summary,
    duration_sec = existing.duration_sec
  } = req.body || {};

  db.prepare(`
    UPDATE walkthroughs SET title = ?, room_scope = ?, summary = ?, duration_sec = ? WHERE id = ?
  `).run(title, room_scope, summary, Number(duration_sec), id);

  const updated = db.prepare('SELECT * FROM walkthroughs WHERE id = ?').get(id);
  res.json({ walkthrough: updated });
});

app.delete('/api/walkthroughs/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM walkthroughs WHERE id = ?').run(id);
  res.json({ success: true });
});

// Create a spatial pin on a video walkthrough (+ optional 1-step Task creation!)
app.post('/api/walkthroughs/:id/pins', requireAuth, (req, res) => {
  const walkthroughId = Number(req.params.id);
  const wt = db.prepare('SELECT * FROM walkthroughs WHERE id = ?').get(walkthroughId);
  if (!wt) return res.status(404).json({ error: 'Walkthrough not found' });

  const {
    title,
    description = '',
    room = 'General',
    action_type = 'fix',
    severity = 'high',
    timestamp_sec = 0,
    end_sec,
    x_pct = 50,
    y_pct = 50,
    task_id = null,
    auto_create_task = false,
    trade_category = 'General Carpentry',
    sequence_phase = 3,
    est_hours_diy = 8,
    est_hours_skilled = 5,
    est_hours_pro = 3,
    pay_type = 'hourly',
    fixed_pay_amount = 0
  } = req.body || {};

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Issue callout title is required' });
  }

  const tx = db.transaction(() => {
    let linkedTaskId = task_id ? Number(task_id) : null;

  if (auto_create_task && !linkedTaskId) {
      const smart = estimateSingleTaskFromSpeech(`${title}. ${description}`, room);
      const maxSeq = db
        .prepare('SELECT COALESCE(MAX(sequence_order), 0) as m FROM tasks WHERE property_id = ?')
        .get(wt.property_id).m;

      const taskInfo = db.prepare(`
        INSERT INTO tasks (
          property_id, title, description, room, action_type, trade_category,
          sequence_phase, sequence_order, sequence_rationale, depends_on_json,
          est_hours_diy, est_hours_skilled, est_hours_pro, tools_json,
          status, pay_type, fixed_pay_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, 'open', ?, ?)
      `).run(
        wt.property_id,
        title.trim(),
        description || smart.description,
        room || smart.room,
        action_type || smart.action_type,
        trade_category || smart.trade_category,
        Number(sequence_phase || smart.sequence_phase),
        maxSeq + 1,
        smart.sequence_rationale,
        Number(est_hours_diy || smart.est_hours_diy),
        Number(est_hours_skilled || smart.est_hours_skilled),
        Number(est_hours_pro || smart.est_hours_pro),
        JSON.stringify(smart.tools || []),
        pay_type || 'hourly',
        Number(fixed_pay_amount || smart.fixed_pay_amount || 0)
      );
      linkedTaskId = taskInfo.lastInsertRowid;

      const matStmt = db.prepare(`
        INSERT INTO task_materials (task_id, property_id, name, quantity, unit, unit_cost, supplier, purchased)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);
      for (const m of smart.materials || []) {
        matStmt.run(linkedTaskId, wt.property_id, m.name, m.quantity, m.unit, m.unit_cost, m.supplier);
      }
    }

    const computedEnd = end_sec != null ? Number(end_sec) : Math.min(wt.duration_sec, Number(timestamp_sec) + 8);
    const pinInfo = db.prepare(`
      INSERT INTO walkthrough_pins (walkthrough_id, property_id, task_id, title, description, room, action_type, severity, timestamp_sec, end_sec, x_pct, y_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      walkthroughId,
      wt.property_id,
      linkedTaskId,
      title.trim(),
      description,
      room,
      action_type,
      severity,
      Number(timestamp_sec),
      computedEnd,
      Number(x_pct),
      Number(y_pct)
    );

    return { pinId: pinInfo.lastInsertRowid, taskId: linkedTaskId };
  });

  const { pinId, taskId } = tx();
  const pin = db.prepare(`
    SELECT wp.*, t.title as task_title, t.status as task_status, t.sequence_order as task_sequence_order
    FROM walkthrough_pins wp
    LEFT JOIN tasks t ON t.id = wp.task_id
    WHERE wp.id = ?
  `).get(pinId);

  res.status(201).json({ pin, created_task_id: taskId });
});

// Preview smart estimate from plain English / voice sentence
app.post('/api/estimate-text', requireAuth, (req, res) => {
  const { text = '', room = 'Kitchen' } = req.body || {};
  const estimate = estimateSingleTaskFromSpeech(text, room);
  res.json({ estimate });
});

// Universal Browser Microphone -> Offline Whisper Transcription (works in Chrome, Edge, Firefox, Safari!)
app.post('/api/transcribe-audio', requireAuth, async (req, res) => {
  const { audio_base64 = '', mime_type = 'audio/webm' } = req.body || {};
  if (!audio_base64) {
    return res.status(400).json({ error: 'No audio recorded' });
  }
  const ext = mime_type.includes('mp4') ? 'm4a' : mime_type.includes('ogg') ? 'ogg' : 'webm';
  const tmpInput = `/tmp/mic_rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  try {
    const cleanB64 = audio_base64.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(tmpInput, Buffer.from(cleanB64, 'base64'));
    const whisperOut = await transcribeVideoFileWithWhisper(tmpInput);
    const text = (whisperOut?.text || '').trim();
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not transcribe microphone audio' });
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
  }
});

// Voice-to-Tasks Generator: Either extracts speech directly from the video's audio track (Whisper)
// OR accepts spoken/typed dictation from the homeowner while watching the video!
app.post('/api/walkthroughs/:id/voice-generate', requireAuth, async (req, res) => {
  try {
    const walkthroughId = Number(req.params.id);
    const wt = db.prepare('SELECT * FROM walkthroughs WHERE id = ?').get(walkthroughId);
    if (!wt) return res.status(404).json({ error: 'Walkthrough not found' });

    const { mode = 'transcript', transcript = '', default_room = 'Kitchen' } = req.body || {};
    let timedStatements = [];
    let fullTranscriptText = transcript;

    if (mode === 'video_audio') {
      const relMedia = wt.video_url.replace(/^\/media\//, '');
      const diskPath = resolveMediaDiskPath(relMedia);
      if (!fs.existsSync(diskPath)) {
        return res.status(400).json({ error: 'Video file not found on server' });
      }
      const whisperOut = await transcribeVideoFileWithWhisper(diskPath);
      fullTranscriptText = (whisperOut?.text || '').trim();

      const chunks = Array.isArray(whisperOut?.chunks) ? whisperOut.chunks : [];
      for (const ch of chunks) {
        const subParts = splitTranscriptIntoStatements(ch.text || '');
        const startSec = Number(ch.timestamp?.[0] ?? 1);
        for (const sp of subParts) {
          timedStatements.push({ text: sp, timestamp_sec: startSec });
        }
      }
      if (timedStatements.length === 0 && fullTranscriptText) {
        const parts = splitTranscriptIntoStatements(fullTranscriptText);
        parts.forEach((p, idx) => {
          const ts = Math.min(
            Math.max(1, (wt.duration_sec || 23) - 2),
            Number(((idx / Math.max(1, parts.length)) * (wt.duration_sec || 23) + 1).toFixed(1))
          );
          timedStatements.push({ text: p, timestamp_sec: ts });
        });
      }

      if (timedStatements.length === 0) {
        return res.status(400).json({
          error:
            'No clear spoken tasks were heard in this video recording. Click "Talk Over Video (Mic)" to speak what needs to be done!'
        });
      }
    } else {
      const parts = splitTranscriptIntoStatements(transcript);
      if (parts.length === 0) {
        return res.status(400).json({ error: 'Please speak or type at least one thing that needs to be done.' });
      }
      parts.forEach((p, idx) => {
        const ts = Math.min(
          Math.max(1, (wt.duration_sec || 23) - 2),
          Number(((idx / Math.max(1, parts.length)) * ((wt.duration_sec || 23) * 0.85) + 1.5).toFixed(1))
        );
        timedStatements.push({ text: p, timestamp_sec: ts });
      });
    }

    // Create pins + sequenced tasks + materials + tools + auto-sort sequence!
    const createdTasks = [];
    const createdPins = [];

    const tx = db.transaction(() => {
      let maxSeq = db
        .prepare('SELECT COALESCE(MAX(sequence_order), 0) as m FROM tasks WHERE property_id = ?')
        .get(wt.property_id).m;

      const taskStmt = db.prepare(`
        INSERT INTO tasks (
          property_id, title, description, room, action_type, trade_category,
          sequence_phase, sequence_order, sequence_rationale, depends_on_json,
          est_hours_diy, est_hours_skilled, est_hours_pro, tools_json,
          status, pay_type, fixed_pay_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, 'open', ?, ?)
      `);

      const matStmt = db.prepare(`
        INSERT INTO task_materials (task_id, property_id, name, quantity, unit, unit_cost, supplier, purchased)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const pinStmt = db.prepare(`
        INSERT INTO walkthrough_pins (walkthrough_id, property_id, task_id, title, description, room, action_type, severity, timestamp_sec, end_sec, x_pct, y_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      timedStatements.forEach((item, idx) => {
        const smart = estimateSingleTaskFromSpeech(item.text, default_room);
        maxSeq += 1;

        const tInfo = taskStmt.run(
          wt.property_id,
          smart.title,
          smart.description,
          smart.room,
          smart.action_type,
          smart.trade_category,
          smart.sequence_phase,
          maxSeq,
          smart.sequence_rationale,
          smart.est_hours_diy,
          smart.est_hours_skilled,
          smart.est_hours_pro,
          JSON.stringify(smart.tools),
          smart.pay_type,
          smart.fixed_pay_amount
        );
        const taskId = tInfo.lastInsertRowid;
        createdTasks.push(taskId);

        for (const m of smart.materials) {
          matStmt.run(taskId, wt.property_id, m.name, m.quantity, m.unit, m.unit_cost, m.supplier);
        }

        // Place visual pin neatly spread in frame (User can drag/edit anytime)
        const xSpread = [35, 62, 48, 28, 70, 52][idx % 6];
        const ySpread = [28, 45, 68, 36, 58, 78][idx % 6];
        const endSec = Math.min(wt.duration_sec || 30, item.timestamp_sec + 7);

        const pInfo = pinStmt.run(
          walkthroughId,
          wt.property_id,
          taskId,
          smart.title,
          smart.description,
          smart.room,
          smart.action_type,
          smart.severity,
          item.timestamp_sec,
          endSec,
          xSpread,
          ySpread
        );
        createdPins.push(pInfo.lastInsertRowid);
      });

      // Automatically re-sequence all tasks in this property into logical First-to-Last build order!
      const allPropTasks = db.prepare('SELECT id, sequence_phase, action_type FROM tasks WHERE property_id = ?').all(wt.property_id);
      const actionWeight = { fix: 1, replace: 2, update: 3 };
      allPropTasks.sort((a, b) => {
        if (a.sequence_phase !== b.sequence_phase) return a.sequence_phase - b.sequence_phase;
        return (actionWeight[a.action_type] || 2) - (actionWeight[b.action_type] || 2) || a.id - b.id;
      });
      const reseqStmt = db.prepare('UPDATE tasks SET sequence_order = ? WHERE id = ?');
      allPropTasks.forEach((t, i) => reseqStmt.run(i + 1, t.id));
    });

    tx();

    res.status(201).json({
      transcript: fullTranscriptText,
      created_count: createdTasks.length
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Voice task generation failed' });
  }
});

app.put('/api/pins/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM walkthrough_pins WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Issue pin not found' });

  const {
    title = existing.title,
    description = existing.description,
    room = existing.room,
    action_type = existing.action_type,
    severity = existing.severity,
    timestamp_sec = existing.timestamp_sec,
    end_sec = existing.end_sec,
    x_pct = existing.x_pct,
    y_pct = existing.y_pct,
    task_id = existing.task_id
  } = req.body || {};

  db.prepare(`
    UPDATE walkthrough_pins
    SET title = ?, description = ?, room = ?, action_type = ?, severity = ?, timestamp_sec = ?, end_sec = ?, x_pct = ?, y_pct = ?, task_id = ?
    WHERE id = ?
  `).run(
    title,
    description,
    room,
    action_type,
    severity,
    Number(timestamp_sec),
    Number(end_sec),
    Number(x_pct),
    Number(y_pct),
    task_id ? Number(task_id) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM walkthrough_pins WHERE id = ?').get(id);
  res.json({ pin: updated });
});

app.delete('/api/pins/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM walkthrough_pins WHERE id = ?').run(id);
  res.json({ success: true });
});

// ==========================================
// TASKS, SEQUENCING & WORKFLOW ROUTES
// ==========================================
app.get('/api/tasks', requireAuth, (req, res) => {
  const propId = req.query.property_id ? Number(req.query.property_id) : null;
  const rows = propId
    ? db.prepare('SELECT * FROM tasks WHERE property_id = ? ORDER BY sequence_order ASC, sequence_phase ASC, id ASC').all(propId)
    : db.prepare('SELECT * FROM tasks ORDER BY property_id ASC, sequence_order ASC, sequence_phase ASC, id ASC').all();

  res.json({ tasks: enrichTasks(rows) });
});

app.post('/api/tasks', requireAuth, requireAdmin, (req, res) => {
  const {
    property_id,
    title,
    description = '',
    room = 'General',
    action_type = 'fix',
    trade_category = 'General Carpentry',
    sequence_phase = 3,
    sequence_order,
    sequence_rationale = '',
    depends_on = [],
    est_hours_diy = 8,
    est_hours_skilled = 5,
    est_hours_pro = 3,
    tools = [],
    assigned_to = null,
    pay_type = 'hourly',
    fixed_pay_amount = 0,
    hourly_rate_override = null,
    materials = [],
    pin_id = null
  } = req.body || {};

  if (!property_id || !title?.trim()) {
    return res.status(400).json({ error: 'Property and task title are required' });
  }

  const tx = db.transaction(() => {
    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(sequence_order), 0) as m FROM tasks WHERE property_id = ?')
      .get(Number(property_id)).m;
    const orderNum = sequence_order != null ? Number(sequence_order) : maxOrder + 1;

    const info = db.prepare(`
      INSERT INTO tasks (
        property_id, title, description, room, action_type, trade_category,
        sequence_phase, sequence_order, sequence_rationale, depends_on_json,
        est_hours_diy, est_hours_skilled, est_hours_pro, tools_json,
        status, assigned_to, pay_type, fixed_pay_amount, hourly_rate_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      Number(property_id),
      title.trim(),
      description,
      room,
      action_type,
      trade_category,
      Number(sequence_phase),
      orderNum,
      sequence_rationale,
      JSON.stringify(Array.isArray(depends_on) ? depends_on.map(Number) : []),
      Number(est_hours_diy),
      Number(est_hours_skilled),
      Number(est_hours_pro),
      JSON.stringify(Array.isArray(tools) ? tools : []),
      assigned_to ? Number(assigned_to) : null,
      pay_type === 'fixed' ? 'fixed' : 'hourly',
      Number(fixed_pay_amount || 0),
      hourly_rate_override !== null && hourly_rate_override !== '' ? Number(hourly_rate_override) : null
    );

    const taskId = info.lastInsertRowid;

    if (Array.isArray(materials) && materials.length > 0) {
      const matStmt = db.prepare(`
        INSERT INTO task_materials (task_id, property_id, name, quantity, unit, unit_cost, supplier, purchased)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of materials) {
        if (m.name?.trim()) {
          matStmt.run(
            taskId,
            Number(property_id),
            m.name.trim(),
            Number(m.quantity || 1),
            m.unit || 'ea',
            Number(m.unit_cost || 0),
            m.supplier || 'Home Depot Pro',
            m.purchased ? 1 : 0
          );
        }
      }
    }

    if (pin_id) {
      db.prepare('UPDATE walkthrough_pins SET task_id = ? WHERE id = ?').run(taskId, Number(pin_id));
    }

    return taskId;
  });

  const taskId = tx();
  const [created] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(taskId));
  res.status(201).json({ task: created });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  // Laborers can update tools checklist on tasks; full scope/pay edits require admin
  if (req.user.role !== 'admin') {
    if (req.body.tools !== undefined) {
      db.prepare('UPDATE tasks SET tools_json = ? WHERE id = ?').run(JSON.stringify(req.body.tools), id);
      const [updated] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(id));
      return res.json({ task: updated });
    }
    return res.status(403).json({ error: 'Only administrators can edit task scope or payout rates' });
  }

  const {
    title = existing.title,
    description = existing.description,
    room = existing.room,
    action_type = existing.action_type,
    trade_category = existing.trade_category,
    sequence_phase = existing.sequence_phase,
    sequence_order = existing.sequence_order,
    sequence_rationale = existing.sequence_rationale,
    depends_on,
    est_hours_diy = existing.est_hours_diy,
    est_hours_skilled = existing.est_hours_skilled,
    est_hours_pro = existing.est_hours_pro,
    tools,
    status = existing.status,
    assigned_to = existing.assigned_to,
    pay_type = existing.pay_type,
    fixed_pay_amount = existing.fixed_pay_amount,
    hourly_rate_override = existing.hourly_rate_override,
    payout_status = existing.payout_status
  } = req.body || {};

  const depsJson = depends_on !== undefined ? JSON.stringify(depends_on.map(Number).filter((d) => d !== id)) : existing.depends_on_json;
  const toolsJson = tools !== undefined ? JSON.stringify(tools) : existing.tools_json;

  db.prepare(`
    UPDATE tasks SET
      title = ?, description = ?, room = ?, action_type = ?, trade_category = ?,
      sequence_phase = ?, sequence_order = ?, sequence_rationale = ?, depends_on_json = ?,
      est_hours_diy = ?, est_hours_skilled = ?, est_hours_pro = ?, tools_json = ?,
      status = ?, assigned_to = ?, pay_type = ?, fixed_pay_amount = ?, hourly_rate_override = ?, payout_status = ?
    WHERE id = ?
  `).run(
    title,
    description,
    room,
    action_type,
    trade_category,
    Number(sequence_phase),
    Number(sequence_order),
    sequence_rationale,
    depsJson,
    Number(est_hours_diy),
    Number(est_hours_skilled),
    Number(est_hours_pro),
    toolsJson,
    status,
    assigned_to ? Number(assigned_to) : null,
    pay_type,
    Number(fixed_pay_amount || 0),
    hourly_rate_override !== null && hourly_rate_override !== '' ? Number(hourly_rate_override) : null,
    payout_status,
    id
  );

  const [updated] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(id));
  res.json({ task: updated });
});

// Workflow State Transitions for BOTH Administrators and Laborers:
// accept | hold | resume | complete | reopen
app.post('/api/tasks/:id/workflow', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const {
    action,
    hold_reason_category = '',
    hold_reason_note = '',
    completion_note = '',
    assigned_to
  } = req.body || {};

  const now = new Date().toISOString();

  if (action === 'accept') {
    const targetAssignee =
      req.user.role === 'admin' && assigned_to !== undefined
        ? Number(assigned_to) || req.user.id
        : task.assigned_to && req.user.role === 'admin'
          ? task.assigned_to
          : req.user.id;

    db.prepare(`
      UPDATE tasks
      SET status = 'accepted', assigned_to = ?, hold_reason_category = '', hold_reason_note = '', accepted_at = COALESCE(accepted_at, ?)
      WHERE id = ?
    `).run(targetAssignee, now, id);
  } else if (action === 'hold') {
    if (!hold_reason_category?.trim() && !hold_reason_note?.trim()) {
      return res.status(400).json({ error: 'Please provide a reason for putting this task on hold' });
    }
    db.prepare(`
      UPDATE tasks
      SET status = 'on_hold', hold_reason_category = ?, hold_reason_note = ?, assigned_to = COALESCE(assigned_to, ?)
      WHERE id = ?
    `).run(
      hold_reason_category || 'Site Blocker',
      hold_reason_note || hold_reason_category,
      req.user.role === 'laborer' ? req.user.id : task.assigned_to,
      id
    );
  } else if (action === 'resume') {
    db.prepare(`
      UPDATE tasks
      SET status = 'accepted', hold_reason_category = '', hold_reason_note = '', assigned_to = COALESCE(assigned_to, ?)
      WHERE id = ?
    `).run(req.user.role === 'laborer' ? req.user.id : task.assigned_to, id);
  } else if (action === 'complete') {
    const nextPayoutStatus = task.payout_status === 'unbilled' ? 'pending_approval' : task.payout_status;
    db.prepare(`
      UPDATE tasks
      SET status = 'completed', completion_note = ?, hold_reason_category = '', hold_reason_note = '',
          completed_at = ?, payout_status = ?, assigned_to = COALESCE(assigned_to, ?)
      WHERE id = ?
    `).run(
      completion_note || task.completion_note || 'Completed and verified on site.',
      now,
      nextPayoutStatus,
      req.user.role === 'laborer' ? req.user.id : task.assigned_to,
      id
    );
  } else if (action === 'reopen') {
    db.prepare(`
      UPDATE tasks
      SET status = 'open', hold_reason_category = '', hold_reason_note = '', completed_at = NULL
      WHERE id = ?
    `).run(id);
  } else {
    return res.status(400).json({ error: 'Unsupported workflow action' });
  }

  const [updated] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(id));
  res.json({ task: updated });
});

// Auto-optimize logical construction sequence or reorder tasks
app.post('/api/properties/:id/resequence', requireAuth, requireAdmin, (req, res) => {
  const propId = Number(req.params.id);
  const { ordered_task_ids } = req.body || {};

  const tx = db.transaction(() => {
    if (Array.isArray(ordered_task_ids) && ordered_task_ids.length > 0) {
      const stmt = db.prepare('UPDATE tasks SET sequence_order = ? WHERE id = ? AND property_id = ?');
      ordered_task_ids.forEach((tid, idx) => {
        stmt.run(idx + 1, Number(tid), propId);
      });
    } else {
      // Smart canonical construction sequencing:
      // Sort by sequence_phase ASC, critical action priority (fix/replace before cosmetic update within same phase), then dependency order
      const tasks = db.prepare('SELECT * FROM tasks WHERE property_id = ?').all(propId);
      const actionWeight = { fix: 1, replace: 2, update: 3 };
      tasks.sort((a, b) => {
        if (a.sequence_phase !== b.sequence_phase) return a.sequence_phase - b.sequence_phase;
        const aw = actionWeight[a.action_type] || 2;
        const bw = actionWeight[b.action_type] || 2;
        if (aw !== bw) return aw - bw;
        return a.id - b.id;
      });
      const stmt = db.prepare('UPDATE tasks SET sequence_order = ? WHERE id = ?');
      tasks.forEach((t, idx) => stmt.run(idx + 1, t.id));
    }
  });

  tx();
  const rows = db
    .prepare('SELECT * FROM tasks WHERE property_id = ? ORDER BY sequence_order ASC, sequence_phase ASC')
    .all(propId);
  res.json({ tasks: enrichTasks(rows) });
});

app.delete('/api/tasks/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const tx = db.transaction(() => {
    // Cleanly remove id from any depends_on_json references
    const others = db.prepare('SELECT id, depends_on_json FROM tasks').all();
    const updateDeps = db.prepare('UPDATE tasks SET depends_on_json = ? WHERE id = ?');
    for (const o of others) {
      try {
        const arr = JSON.parse(o.depends_on_json || '[]');
        if (arr.includes(id)) {
          updateDeps.run(JSON.stringify(arr.filter((x) => x !== id)), o.id);
        }
      } catch {
        // ignore
      }
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  });
  tx();
  res.json({ success: true });
});

// ==========================================
// TASK MATERIALS ROUTES
// ==========================================
app.post('/api/tasks/:taskId/materials', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { name, quantity = 1, unit = 'ea', unit_cost = 0, supplier = 'Home Depot Pro', purchased = false } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Material name is required' });

  const info = db.prepare(`
    INSERT INTO task_materials (task_id, property_id, name, quantity, unit, unit_cost, supplier, purchased)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, task.property_id, name.trim(), Number(quantity), unit, Number(unit_cost), supplier, purchased ? 1 : 0);

  const mat = db.prepare('SELECT * FROM task_materials WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ material: { ...mat, purchased: Boolean(mat.purchased) } });
});

app.put('/api/materials/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM task_materials WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Material not found' });

  const {
    name = existing.name,
    quantity = existing.quantity,
    unit = existing.unit,
    unit_cost = existing.unit_cost,
    supplier = existing.supplier,
    purchased = Boolean(existing.purchased)
  } = req.body || {};

  db.prepare(`
    UPDATE task_materials SET name = ?, quantity = ?, unit = ?, unit_cost = ?, supplier = ?, purchased = ? WHERE id = ?
  `).run(name, Number(quantity), unit, Number(unit_cost), supplier, purchased ? 1 : 0, id);

  const mat = db.prepare('SELECT * FROM task_materials WHERE id = ?').get(id);
  res.json({ material: { ...mat, purchased: Boolean(mat.purchased) } });
});

app.delete('/api/materials/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM task_materials WHERE id = ?').run(id);
  res.json({ success: true });
});

// ==========================================
// LABOR HOURS (TIME LOGS) & PAYOUT ROUTES
// ==========================================
app.get('/api/time-logs', requireAuth, (req, res) => {
  const propId = req.query.property_id ? Number(req.query.property_id) : null;
  const query = `
    SELECT tl.*, u.name as user_name, u.avatar_color, u.hourly_rate as user_hourly_rate, u.specialty,
           t.title as task_title, t.pay_type, t.fixed_pay_amount, t.hourly_rate_override, t.payout_status,
           p.name as property_name
    FROM time_logs tl
    JOIN users u ON u.id = tl.user_id
    JOIN tasks t ON t.id = tl.task_id
    JOIN properties p ON p.id = tl.property_id
    ${propId ? 'WHERE tl.property_id = ?' : ''}
    ORDER BY tl.work_date DESC, tl.id DESC
  `;
  const rows = propId ? db.prepare(query).all(propId) : db.prepare(query).all();
  res.json({
    time_logs: rows.map((r) => ({
      ...r,
      approved: Boolean(r.approved),
      effective_rate: r.hourly_rate_override ?? r.user_hourly_rate ?? 50
    }))
  });
});

app.post('/api/tasks/:taskId/time-logs', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const {
    hours,
    work_date = new Date().toISOString().slice(0, 10),
    note = '',
    user_id
  } = req.body || {};

  const numHours = Number(hours);
  if (!numHours || numHours <= 0) {
    return res.status(400).json({ error: 'Hours worked must be greater than 0' });
  }

  const targetUserId = req.user.role === 'admin' && user_id ? Number(user_id) : req.user.id;

  const info = db.prepare(`
    INSERT INTO time_logs (task_id, property_id, user_id, work_date, hours, note, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, task.property_id, targetUserId, work_date, numHours, note, req.user.role === 'admin' ? 1 : 0);

  const [updatedTask] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(taskId));
  res.status(201).json({ id: info.lastInsertRowid, task: updatedTask });
});

app.put('/api/time-logs/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Time log not found' });

  if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own time entries' });
  }

  const {
    hours = existing.hours,
    work_date = existing.work_date,
    note = existing.note,
    approved = Boolean(existing.approved)
  } = req.body || {};

  const nextApproved = req.user.role === 'admin' ? (approved ? 1 : 0) : existing.approved;

  db.prepare(`
    UPDATE time_logs SET hours = ?, work_date = ?, note = ?, approved = ? WHERE id = ?
  `).run(Number(hours), work_date, note, nextApproved, id);

  res.json({ success: true });
});

app.delete('/api/time-logs/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Time log not found' });
  if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own time entries' });
  }
  db.prepare('DELETE FROM time_logs WHERE id = ?').run(id);
  res.json({ success: true });
});

app.put('/api/tasks/:id/payout', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const {
    pay_type = existing.pay_type,
    fixed_pay_amount = existing.fixed_pay_amount,
    hourly_rate_override = existing.hourly_rate_override,
    payout_status = existing.payout_status
  } = req.body || {};

  db.prepare(`
    UPDATE tasks
    SET pay_type = ?, fixed_pay_amount = ?, hourly_rate_override = ?, payout_status = ?
    WHERE id = ?
  `).run(
    pay_type,
    Number(fixed_pay_amount || 0),
    hourly_rate_override !== null && hourly_rate_override !== '' ? Number(hourly_rate_override) : null,
    payout_status,
    id
  );

  // If marked paid/approved, also mark associated time logs approved
  if (payout_status === 'approved' || payout_status === 'paid') {
    db.prepare('UPDATE time_logs SET approved = 1 WHERE task_id = ?').run(id);
  }

  const [updated] = enrichTasks(db.prepare('SELECT * FROM tasks WHERE id = ?').all(id));
  res.json({ task: updated });
});

// ==========================================
// VITE DEV MIDDLEWARE OR PROD STATIC SERVE
// ==========================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(APP_ROOT, 'public_app');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlumbLine Renovation Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
