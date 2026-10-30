import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';

const appRoot = process.cwd();
const persistentVolume = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.STORAGE_DIR || '';
const bundledDbPath = path.resolve(appRoot, 'data', 'plumbline.db');

const dataDir = persistentVolume
  ? path.resolve(persistentVolume, 'data')
  : path.resolve(appRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'plumbline.db');

// On first boot with an empty Railway Volume, seed it with Don's pre-built database!
if (persistentVolume && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
  fs.copyFileSync(bundledDbPath, dbPath);
}

const db = new Database(dbPath);

db.pragma('journal_mode = DELETE');
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'laborer')),
      persona_type TEXT NOT NULL DEFAULT 'Contractor',
      experience_level TEXT NOT NULL DEFAULT 'pro' CHECK(experience_level IN ('diy', 'skilled', 'pro')),
      hourly_rate REAL NOT NULL DEFAULT 50,
      specialty TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#D97706',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city_state TEXT NOT NULL DEFAULT 'Knoxville, TN',
      project_type TEXT NOT NULL CHECK(project_type IN ('Fix & Flip', 'Homeowner Remodel', 'Client Contract')),
      status TEXT NOT NULL DEFAULT 'Active Rehab' CHECK(status IN ('Inspection & Scope', 'Active Rehab', 'Punch List', 'Completed')),
      sqft INTEGER NOT NULL DEFAULT 1800,
      year_built INTEGER NOT NULL DEFAULT 1975,
      beds INTEGER NOT NULL DEFAULT 3,
      baths REAL NOT NULL DEFAULT 2,
      purchase_price REAL NOT NULL DEFAULT 0,
      rehab_budget REAL NOT NULL DEFAULT 50000,
      arv_estimate REAL NOT NULL DEFAULT 0,
      target_date TEXT DEFAULT '2026-12-15',
      cover_image TEXT DEFAULT '/media/frames/exterior_deck_roof.jpg',
      notes TEXT DEFAULT '',
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS walkthroughs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      room_scope TEXT NOT NULL DEFAULT 'Full Property',
      video_url TEXT NOT NULL,
      thumbnail_url TEXT DEFAULT '/media/frames/kitchen_inspection.jpg',
      duration_sec REAL NOT NULL DEFAULT 64,
      recorded_by TEXT NOT NULL DEFAULT 'Marcus Vance',
      summary TEXT DEFAULT '',
      chapters_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT 'General',
      action_type TEXT NOT NULL DEFAULT 'fix' CHECK(action_type IN ('fix', 'replace', 'update')),
      trade_category TEXT NOT NULL DEFAULT 'General Carpentry',
      sequence_phase INTEGER NOT NULL DEFAULT 1,
      sequence_order INTEGER NOT NULL DEFAULT 1,
      sequence_rationale TEXT DEFAULT '',
      depends_on_json TEXT NOT NULL DEFAULT '[]',
      est_hours_diy REAL NOT NULL DEFAULT 8,
      est_hours_skilled REAL NOT NULL DEFAULT 5,
      est_hours_pro REAL NOT NULL DEFAULT 3,
      tools_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'accepted', 'on_hold', 'completed')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      hold_reason_category TEXT DEFAULT '',
      hold_reason_note TEXT DEFAULT '',
      completion_note TEXT DEFAULT '',
      pay_type TEXT NOT NULL DEFAULT 'hourly' CHECK(pay_type IN ('hourly', 'fixed')),
      fixed_pay_amount REAL NOT NULL DEFAULT 0,
      hourly_rate_override REAL,
      payout_status TEXT NOT NULL DEFAULT 'unbilled' CHECK(payout_status IN ('unbilled', 'pending_approval', 'approved', 'paid')),
      accepted_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS walkthrough_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walkthrough_id INTEGER NOT NULL REFERENCES walkthroughs(id) ON DELETE CASCADE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT 'Kitchen',
      action_type TEXT NOT NULL DEFAULT 'fix' CHECK(action_type IN ('fix', 'replace', 'update')),
      severity TEXT NOT NULL DEFAULT 'high' CHECK(severity IN ('critical', 'high', 'medium', 'cosmetic')),
      timestamp_sec REAL NOT NULL DEFAULT 0,
      end_sec REAL NOT NULL DEFAULT 8,
      x_pct REAL NOT NULL DEFAULT 50,
      y_pct REAL NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'ea',
      unit_cost REAL NOT NULL DEFAULT 0,
      supplier TEXT DEFAULT 'Home Depot Pro',
      purchased INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_date TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 1,
      note TEXT DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  const hash = bcrypt.hashSync('demo1234', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, persona_type, experience_level, hourly_rate, specialty, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run(
    'Marcus Vance',
    'marcus@plumbline.build',
    hash,
    'admin',
    'House Flipper & GC',
    'pro',
    0,
    'Project Management, Acquisitions & Scope Sequencing',
    '#D97706'
  ).lastInsertRowid;

  const homeownerAdminId = insertUser.run(
    'Sarah Jenkins',
    'sarah@plumbline.build',
    hash,
    'admin',
    'Homeowner Remodeler',
    'diy',
    0,
    'Owner-Builder Kitchen & Bath Remodel',
    '#0284C7'
  ).lastInsertRowid;

  const carlosId = insertUser.run(
    'Carlos Rivera',
    'carlos@plumbline.build',
    hash,
    'laborer',
    'Lead Plumber & Framer',
    'pro',
    62,
    'Rough Plumbing, Structural Framing & Decking',
    '#059669'
  ).lastInsertRowid;

  const elenaId = insertUser.run(
    'Elena Rostova',
    'elena@plumbline.build',
    hash,
    'laborer',
    'Master Electrician',
    'pro',
    75,
    '200A Panel Upgrades, Rough Rewiring & Lighting',
    '#7C3AED'
  ).lastInsertRowid;

  const devonId = insertUser.run(
    'Devon Brooks',
    'devon@plumbline.build',
    hash,
    'laborer',
    'Skilled Rehab Tech',
    'skilled',
    42,
    'Selective Demo, Foundation Crack Repair, Drywall & Tile',
    '#DC2626'
  ).lastInsertRowid;

  // Seed Properties
  const insertProp = db.prepare(`
    INSERT INTO properties (name, address, city_state, project_type, status, sqft, year_built, beds, baths, purchase_price, rehab_budget, arv_estimate, target_date, cover_image, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const prop1 = insertProp.run(
    '418 Maplewood Craftsman Flip',
    '418 Maplewood Ave',
    'Knoxville, TN 37917',
    'Fix & Flip',
    'Active Rehab',
    1940,
    1928,
    4,
    2.5,
    215000,
    68500,
    368000,
    '2026-12-18',
    '/media/frames/exterior_deck_roof.jpg',
    'Full mechanical & cosmetic flip in Fourth & Gill historic corridor. Priority critical path: cure foundation intrusion + exterior gutter runoff first, complete 200A service & cast-iron stack replacement before closing wet walls.',
    adminId
  ).lastInsertRowid;

  const prop2 = insertProp.run(
    '1209 Cherokee Blvd Ranch Remodel',
    '1209 Cherokee Trail',
    'Knoxville, TN 37920',
    'Homeowner Remodel',
    'Active Rehab',
    1680,
    1976,
    3,
    2,
    0,
    34000,
    415000,
    '2026-11-30',
    '/media/frames/kitchen_inspection.jpg',
    'Owner-occupied kitchen & primary bathroom modernization. Combining homeowner DIY prep/paint with licensed pro rough-ins to save 28% on labor.',
    homeownerAdminId
  ).lastInsertRowid;

  const prop3 = insertProp.run(
    '742 Cedar Bluff Duplex — Unit B',
    '742 Cedar Bluff Rd',
    'Knoxville, TN 37923',
    'Client Contract',
    'Inspection & Scope',
    2240,
    1984,
    4,
    3,
    260000,
    29500,
    345000,
    '2027-01-20',
    '/media/frames/basement_mechanicals.jpg',
    'Contractor turn-key rehab scope between tenants: rear deck structural safety compliance, fascia drainage, and basement electrical subpanel.',
    adminId
  ).lastInsertRowid;

  // Seed Walkthroughs
  const insertWalkthrough = db.prepare(`
    INSERT INTO walkthroughs (property_id, title, room_scope, video_url, thumbnail_url, duration_sec, recorded_by, summary, chapters_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const wt1 = insertWalkthrough.run(
    prop1,
    'Initial Acquisition Inspection — Full 4-Zone Walkthrough',
    'Basement, Exterior, Kitchen & Bath',
    '/media/videos/full_house_walkthrough.mp4',
    '/media/frames/kitchen_inspection.jpg',
    64,
    'Marcus Vance (GC)',
    'Complete room-by-room acquisition walkthrough calling out 10 structural, MEP, and cosmetic issues across basement foundation, rear deck/gutters, dated kitchen wet-wall, and primary bath.',
    JSON.stringify([
      { label: 'Basement & MEP', start: 0, end: 16 },
      { label: 'Rear Deck & Gutters', start: 16, end: 32 },
      { label: 'Kitchen Wet-Wall', start: 32, end: 48 },
      { label: 'Primary Bathroom', start: 48, end: 64 }
    ])
  ).lastInsertRowid;

  const wt2 = insertWalkthrough.run(
    prop2,
    'Wet-Wall Plumbing & Finish Scope Tour',
    'Kitchen & Primary Bath',
    '/media/videos/kitchen_bath_walkthrough.mp4',
    '/media/frames/bathroom_inspection.jpg',
    32,
    'Sarah Jenkins & Carlos Rivera',
    'Detailed inspection of under-sink drain corrosion, ceiling moisture staining, cracked bathroom floor tile, and fiberglass shower valve replacement.',
    JSON.stringify([
      { label: 'Kitchen Inspection', start: 0, end: 16 },
      { label: 'Primary Bath Inspection', start: 16, end: 32 }
    ])
  ).lastInsertRowid;

  const wt3 = insertWalkthrough.run(
    prop3,
    'Exterior Envelope & Structural Ledger Walkthrough',
    'Rear Deck & Basement Utility',
    '/media/videos/structural_exterior_walkthrough.mp4',
    '/media/frames/exterior_deck_roof.jpg',
    32,
    'Marcus Vance (GC)',
    'Pre-bid contractor inspection verifying deck ledger lag fastening, bowed eave gutter runoff, and basement foundation/panel access.',
    JSON.stringify([
      { label: 'Exterior Deck & Roofline', start: 0, end: 16 },
      { label: 'Basement Foundation & Panel', start: 16, end: 32 }
    ])
  ).lastInsertRowid;

  // Seed Sequenced Tasks for Property 1 (418 Maplewood Craftsman Flip)
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      property_id, title, description, room, action_type, trade_category,
      sequence_phase, sequence_order, sequence_rationale, depends_on_json,
      est_hours_diy, est_hours_skilled, est_hours_pro, tools_json,
      status, assigned_to, hold_reason_category, hold_reason_note, completion_note,
      pay_type, fixed_pay_amount, hourly_rate_override, payout_status, accepted_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Task 1: Phase 1 - Selective Demo (Completed, Hourly)
  const t1 = insertTask.run(
    prop1,
    'Selective Gut Demo: Kitchen Sink Base & Cracked Bath Tile',
    'Strip water-damaged sink cabinet floor, remove cracked bathroom ceramic tile down to subfloor, and expose wet-wall framing for plumber & electrician access.',
    'Kitchen & Bath',
    'replace',
    'Demolition',
    1,
    1,
    'Phase 1 First Step: Open damaged wet walls and floors first so hidden subfloor rot or pipe corrosion is exposed before rough trades arrive.',
    JSON.stringify([]),
    14,
    8.5,
    5.5,
    JSON.stringify([
      { id: 'tl-1', name: 'Reciprocating Saw (Sawzall) + Demo Blades', category: 'power', owned: true },
      { id: 'tl-2', name: 'SDS-Plus Rotary Hammer w/ Chisel Bit', category: 'specialty', owned: true },
      { id: 'tl-3', name: 'Pry Bar, N95 Respirator & Heavy Contractor Bags', category: 'hand', owned: true }
    ]),
    'completed',
    devonId,
    '',
    '',
    'Demo complete, 2 yds debris loaded into dumpster. Subfloor under toilet has 2x3 ft soft spot flagged for Carlos.',
    'hourly',
    0,
    42,
    'paid',
    '2026-10-14T08:00:00Z',
    '2026-10-15T16:30:00Z'
  ).lastInsertRowid;

  // Task 2: Phase 2 - Exterior Gutter & Drainage (Completed, Fixed Payout)
  const t2 = insertTask.run(
    prop1,
    'Re-pitch Bowed Fascia & Install 6" Seamless Gutter + Downspout',
    'Fix sagging rear aluminum gutter and detached downspout that has been dumping roof runoff directly against the basement foundation wall.',
    'Exterior',
    'fix',
    'Exterior & Roofing',
    2,
    2,
    'Phase 2 Dry-In Priority: Stop active roof water dumping at the foundation perimeter BEFORE injecting interior basement foundation crack.',
    JSON.stringify([]),
    9.5,
    5.5,
    3.5,
    JSON.stringify([
      { id: 'tl-4', name: '24ft Extension Ladder w/ Stabilizer', category: 'specialty', owned: true },
      { id: 'tl-5', name: '2ft Torpedo Level & Chalk Line', category: 'hand', owned: true },
      { id: 'tl-6', name: 'Cordless Impact Driver + Tin Snips', category: 'power', owned: true }
    ]),
    'completed',
    devonId,
    '',
    '',
    'Installed new 26ft seamless K-style gutter at 1/4" per 10ft slope and extended downspout 6ft clear of foundation.',
    'fixed',
    480,
    null,
    'approved',
    '2026-10-16T09:00:00Z',
    '2026-10-16T15:00:00Z'
  ).lastInsertRowid;

  // Task 3: Phase 2 - Foundation Crack Epoxy/Polyurethane Injection (Accepted / In Progress, Fixed Payout)
  const t3 = insertTask.run(
    prop1,
    'Epoxy & Polyurethane Structural Foundation Crack Injection',
    'Wire-brush efflorescence along diagonal poured-concrete wall crack, set surface injection ports every 8 inches, seal face with structural epoxy paste, and low-pressure inject hydrophobic polyurethane foam.',
    'Basement',
    'fix',
    'Structural & Foundation',
    2,
    3,
    'Phase 2 Structural Envelope: Must cure foundation moisture intrusion after exterior gutter diversion (#2) and before basement framing or electrical panel mount.',
    JSON.stringify([t2]),
    11,
    6.5,
    4,
    JSON.stringify([
      { id: 'tl-7', name: '4.5" Angle Grinder w/ Wire Cup Brush', category: 'power', owned: true },
      { id: 'tl-8', name: 'Dual-Cartridge High-Thrust Injection Gun', category: 'specialty', owned: false },
      { id: 'tl-9', name: 'Shop-Vac w/ HEPA Filter', category: 'power', owned: true }
    ]),
    'accepted',
    devonId,
    '',
    '',
    '',
    'fixed',
    650,
    null,
    'unbilled',
    '2026-10-20T08:30:00Z',
    null
  ).lastInsertRowid;

  // Task 4: Phase 2 - Structural Deck Ledger & Guardrail Replacement (Accepted / In Progress, Hourly)
  const t4 = insertTask.run(
    prop1,
    'Retrofit Deck Ledger Lag-Bolts, Rim Joist & 36" Code Balusters',
    'Install structural tension ties and 1/2" hot-dipped galvanized ledgerlok lags w/ flashing tape, replace weathered front rim board, and install missing balusters (< 4" sphere spacing).',
    'Exterior Deck',
    'replace',
    'Structural & Framing',
    2,
    4,
    'Phase 2 Exterior Safety & Framing: Secures exterior structural envelope early so rear staging entrance is safe for material delivery.',
    JSON.stringify([]),
    16,
    9.5,
    6,
    JSON.stringify([
      { id: 'tl-10', name: '1/2" High-Torque Impact Wrench', category: 'power', owned: true },
      { id: 'tl-11', name: '7-1/4" Circular Saw & Speed Square', category: 'power', owned: true },
      { id: 'tl-12', name: '4ft Carpenter Box Level', category: 'hand', owned: true }
    ]),
    'accepted',
    carlosId,
    '',
    '',
    '',
    'hourly',
    0,
    62,
    'unbilled',
    '2026-10-19T10:00:00Z',
    null
  ).lastInsertRowid;

  // Task 5: Phase 3 - Cast Iron Stack & Kitchen Under-Sink Rough Plumbing (ON HOLD - Dramatic realistic blocker!)
  const t5 = insertTask.run(
    prop1,
    'Replace Corroded Cast Iron Waste Stack & Kitchen P-Trap Rough-In',
    'Cut out scaled/cracked 4" vertical cast iron stack section in basement up through kitchen wet wall; replace with Schedule 40 PVC w/ shielded Fernco couplings, new cleanout, quarter-turn PEX shutoffs, and under-sink P-trap.',
    'Basement & Kitchen',
    'replace',
    'Rough Plumbing',
    3,
    5,
    'Phase 3 Rough-In MEP: Drain-waste-vent (DWV) larger diameter gravity lines always run BEFORE flexible electrical wiring and BEFORE closing cabinets/walls.',
    JSON.stringify([t1]),
    18,
    10,
    6.5,
    JSON.stringify([
      { id: 'tl-13', name: 'Soil Pipe Ratchet Snap Cutter', category: 'specialty', owned: true },
      { id: 'tl-14', name: 'PEX-A Expansion / Crimping Tool', category: 'specialty', owned: true },
      { id: 'tl-15', name: '60 in-lb Torque Wrench (for No-Hub Couplings)', category: 'hand', owned: true }
    ]),
    'on_hold',
    carlosId,
    'Hidden Damage / Hazard',
    'Curb main shutoff valve corroded seized & horizontal branch into municipal clay lateral shows root intrusion at basement floor slab. Need city water curb key shutoff + camera scope approval before cutting stack.',
    '',
    'hourly',
    0,
    62,
    'unbilled',
    '2026-10-20T07:45:00Z',
    null
  ).lastInsertRowid;

  // Task 6: Phase 3 - Upgrade 100A Panel to 200A Main Service & Kitchen/Bath GFCI Circuits (Accepted, Fixed Payout)
  const t6 = insertTask.run(
    prop1,
    'Upgrade 100A Breaker Box to 200A Panel + Dedicated 240V Range & Bath GFCI',
    'Remove aged 100A gray basement panel, mount 200A 40-space copper-bus main breaker panel on treated plywood backer, pull 6/3 NM-B for kitchen slide-in range, and run 20A AFCI/GFCI small-appliance & bath circuits.',
    'Basement & Kitchen',
    'replace',
    'Rough Electrical',
    3,
    6,
    'Phase 3 Rough-In MEP: Pull rough Romex circuits after demo (#1) and foundation wall prep (#3), BEFORE municipal rough-in inspection and drywall close-in.',
    JSON.stringify([t1, t3]),
    28,
    16,
    9.5,
    JSON.stringify([
      { id: 'tl-16', name: 'True-RMS Digital Multimeter & Non-Contact Voltage Tester', category: 'specialty', owned: true },
      { id: 'tl-17', name: 'Insulated Torque Screwdriver Set', category: 'hand', owned: true },
      { id: 'tl-18', name: '50ft Fiberglass Fish Tape & Knockout Punch', category: 'specialty', owned: true }
    ]),
    'accepted',
    elenaId,
    '',
    '',
    '',
    'fixed',
    1850,
    null,
    'unbilled',
    '2026-10-21T08:00:00Z',
    null
  ).lastInsertRowid;

  // Task 7: Phase 3 - Gut Tub Valve & Install Pressure-Balanced Mixing Valve + 110 CFM Exhaust Fan (Open, Hourly)
  const t7 = insertTask.run(
    prop1,
    'Install Brass Pressure-Balanced Shower Valve & Vented 110 CFM Bath Fan',
    'Remove corroded shower valve & moldy fiberglass surround; sweat/PEX-connect new brass rough-in mixing valve at proper tile depth and duct quiet 110 CFM exhaust fan through roof soffit.',
    'Primary Bathroom',
    'replace',
    'Rough Plumbing',
    3,
    7,
    'Phase 3 Rough-In MEP: Shower valve body and exhaust ducting must be rough-inspected inside open wall framing before hanging cement backer board.',
    JSON.stringify([t1]),
    13,
    7.5,
    4.5,
    JSON.stringify([
      { id: 'tl-19', name: 'Propane Torch / ProPress or PEX Crimp Kit', category: 'specialty', owned: true },
      { id: 'tl-20', name: '4-1/4" Bi-Metal Hole Saw (Soffit Vent)', category: 'power', owned: true }
    ]),
    'open',
    null,
    '',
    '',
    '',
    'hourly',
    0,
    62,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Task 8: Phase 5 - Repair Ceiling Drywall Water Stains & Skim Coat (Open, Fixed Payout)
  const t8 = insertTask.run(
    prop1,
    'Cut Out Stained Ceiling Drywall, Hang Moisture-Resistant Board & Skim Coat',
    'Remove water-stained kitchen ceiling drywall near old fluorescent fixture and peeling bathroom ceiling plaster; hang 1/2" mold-resistant drywall, tape, 3-coat mud, sand, and stain-block prime.',
    'Kitchen & Bath',
    'fix',
    'Drywall & Waterproofing',
    5,
    8,
    'Phase 5 Drywall Close-In: NEVER hang or mud ceiling drywall until all overhead rough plumbing (#5, #7) and electrical (#6) have passed leak & rough inspection.',
    JSON.stringify([t5, t6, t7]),
    15,
    8.5,
    5,
    JSON.stringify([
      { id: 'tl-21', name: 'Drywall Screw Gun & T-Square', category: 'power', owned: true },
      { id: 'tl-22', name: '6", 10" & 12" Stainless Taping Knives + Mud Pan', category: 'hand', owned: true },
      { id: 'tl-23', name: 'Pole Sander w/ Vacuum Hose Attachment', category: 'specialty', owned: false }
    ]),
    'open',
    devonId,
    '',
    '',
    '',
    'fixed',
    620,
    null,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Task 9: Phase 6 - Cement Backer, RedGard Waterproofing & Porcelain Bath Tile (Open, Fixed Payout)
  const t9 = insertTask.run(
    prop1,
    'Waterproof Tub Alcove & Lay 12x24 Porcelain Floor & Surround Tile',
    'Sister soft toilet subfloor, fasten 1/2" cement board on shower walls & 1/4" uncoupling membrane on floor, roll 2 coats liquid waterproofing membrane, and set porcelain tile w/ polymer-modified thinset.',
    'Primary Bathroom',
    'replace',
    'Tile & Flooring',
    6,
    9,
    'Phase 6 Waterproofing & Tile: Follows drywall ceiling prep (#8) so drywall dust/mud doesn’t foul fresh grout, and precedes vanity & toilet setting (#11).',
    JSON.stringify([t7, t8]),
    26,
    15,
    9.5,
    JSON.stringify([
      { id: 'tl-24', name: '7" Sliding Table Wet Tile Saw w/ Diamond Blade', category: 'specialty', owned: false },
      { id: 'tl-25', name: '1/2" x 1/2" Square-Notch Trowel & Grout Float', category: 'hand', owned: true },
      { id: 'tl-26', name: 'Cross-Line Laser Level', category: 'specialty', owned: true }
    ]),
    'open',
    null,
    '',
    '',
    '',
    'fixed',
    1450,
    null,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Task 10: Phase 6 - Update Kitchen Shaker Cabinets, Vented Range Hood & Quartz Prep (Open, Hourly)
  const t10 = insertTask.run(
    prop1,
    'Install Shaker Kitchen Cabinets, Vented Hood & Quartz Countertop Template',
    'Remove worn 1970s honey-oak cabinets & laminate tops; laser-level and shim new soft-close shaker wall and base cabinets, duct range hood exteriorly, and prep level perimeter for quartz fabrication.',
    'Kitchen',
    'update',
    'Cabinetry & Finish',
    6,
    10,
    'Phase 6 Millwork & Cabinets: Set cabinets after ceiling drywall & prime (#8) are complete, and before finish plumbing hookup & slide-in range.',
    JSON.stringify([t5, t6, t8]),
    24,
    14,
    8.5,
    JSON.stringify([
      { id: 'tl-27', name: '360-Degree Green Laser Level', category: 'specialty', owned: true },
      { id: 'tl-28', name: 'Cabinet Claw Clamps & Brad Nailer', category: 'specialty', owned: true },
      { id: 'tl-29', name: 'Stud Finder & Countersink Drill Set', category: 'power', owned: true }
    ]),
    'open',
    carlosId,
    '',
    '',
    '',
    'hourly',
    0,
    62,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Task 11: Phase 8 - Final Trim Fixtures: 36" Bath Vanity, Toilet Reset & Slide-In Range (Open, Fixed Payout)
  const t11 = insertTask.run(
    prop1,
    'Set 36" Bath Vanity, Wax-Free Toilet Flange, LED Lighting & 240V Range',
    'Install modern 36" shaker vanity & matte black faucet over finished porcelain tile, set elongated ADA toilet on reinforced flange, swap fluorescent box for 4000K LED flushmount, and level 240V slide-in range.',
    'Kitchen & Bath',
    'update',
    'Finish Plumbing & Trim',
    8,
    11,
    'Phase 8 Final Trim & Punch: Finish fixtures go in LAST so porcelain tile (#9) and cabinets (#10) are cured and zero paint/grout damage hits new fixtures.',
    JSON.stringify([t9, t10]),
    12,
    7,
    4.5,
    JSON.stringify([
      { id: 'tl-30', name: 'Basin Wrench & Strap Wrench', category: 'hand', owned: true },
      { id: 'tl-31', name: 'Silicone Caulking Gun & Circuit Receptacle Tester', category: 'hand', owned: true }
    ]),
    'open',
    null,
    '',
    '',
    '',
    'fixed',
    550,
    null,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Seed Tasks for Property 2 (1209 Cherokee Blvd Ranch Remodel)
  const p2t1 = insertTask.run(
    prop2,
    'Fix Kitchen Under-Sink Leaking P-Trap & Replace Rotted Cabinet Deck',
    'Cut out swollen particleboard cabinet floor, seal subfloor w/ shellac primer, install new 1/2" birch ply base + waterproof mat, and rebuild 1-1/2" tubular PVC P-trap.',
    'Kitchen',
    'fix',
    'Rough Plumbing',
    3,
    1,
    'Stop active slow sink leak first before refinishing cabinets or laying LVP plank flooring.',
    JSON.stringify([]),
    6.5,
    3.5,
    2.0,
    JSON.stringify([
      { id: 'tl-32', name: 'Oscillating Multi-Tool (Flush Cut Blade)', category: 'power', owned: true },
      { id: 'tl-33', name: 'Channel-Lock Pliers & PVC Cutter', category: 'hand', owned: true }
    ]),
    'completed',
    carlosId,
    '',
    '',
    'Leak eliminated, birch ply deck sealed and installed cleanly.',
    'fixed',
    275,
    null,
    'paid',
    '2026-10-17T09:00:00Z',
    '2026-10-17T12:15:00Z'
  ).lastInsertRowid;

  const p2t2 = insertTask.run(
    prop2,
    'Replace Cracked Bath Floor Tile with Waterproof Rigid-Core LVP',
    'Demo cracked beige ceramic tile, feather-finish subfloor low spots, lay waterproof 20-mil wear-layer LVP planks, and reset toilet w/ new reinforced wax ring.',
    'Primary Bathroom',
    'replace',
    'Tile & Flooring',
    7,
    2,
    'Complete wet plumbing repairs (#1) before installing continuous waterproof flooring.',
    JSON.stringify([p2t1]),
    10.5,
    6,
    3.5,
    JSON.stringify([
      { id: 'tl-34', name: 'LVP Tapping Block, Pull Bar & Rubber Mallet', category: 'hand', owned: true },
      { id: 'tl-35', name: 'Jigsaw w/ Laminate Blade', category: 'power', owned: true }
    ]),
    'accepted',
    devonId,
    '',
    '',
    '',
    'hourly',
    0,
    42,
    'unbilled',
    '2026-10-21T09:00:00Z',
    null
  ).lastInsertRowid;

  const p2t3 = insertTask.run(
    prop2,
    'Update Tarnished Vanity, Mirror & Install Matte Black Fixture Trim',
    'Swap dated oak single-sink vanity and tarnished brass faucet for 36" freestanding vanity, framed LED mirror, and matte black supply stops.',
    'Primary Bathroom',
    'update',
    'Cabinetry & Finish',
    8,
    3,
    'Set new freestanding vanity ON TOP of finished LVP floor (#2) for clean shoe-molding-free transitions.',
    JSON.stringify([p2t2]),
    7,
    4,
    2.5,
    JSON.stringify([
      { id: 'tl-36', name: '2ft Level, Stud Finder & Adjustable Wrench', category: 'hand', owned: true }
    ]),
    'open',
    null,
    '',
    '',
    '',
    'fixed',
    340,
    null,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Seed Tasks for Property 3 (742 Cedar Bluff Duplex)
  const p3t1 = insertTask.run(
    prop3,
    'Replace Exterior Peeling Slider Trim w/ Cellular PVC & Sill Flashing',
    'Remove rotted wood brickmold around rear sliding patio door, apply butyl flashing tape, install rot-proof cellular PVC trim, and caulk w/ elastomeric sealant.',
    'Exterior',
    'update',
    'Exterior & Roofing',
    2,
    1,
    'Seal exterior building envelope openings before interior drywall touchups.',
    JSON.stringify([]),
    8,
    4.5,
    3,
    JSON.stringify([
      { id: 'tl-37', name: '10" Compound Miter Saw', category: 'power', owned: true },
      { id: 'tl-38', name: '16-Gauge Finish Nailer', category: 'power', owned: true }
    ]),
    'open',
    null,
    '',
    '',
    '',
    'fixed',
    420,
    null,
    'unbilled',
    null,
    null
  ).lastInsertRowid;

  // Seed Walkthrough Spatial Issue Pins for Walkthrough 1 (64s Full House Walkthrough)
  // Remember segment windows:
  // 00:00 - 00:16 => basement_mechanicals.jpg
  // 00:16 - 00:32 => exterior_deck_roof.jpg
  // 00:32 - 00:48 => kitchen_inspection.jpg
  // 00:48 - 01:04 => bathroom_inspection.jpg
  const insertPin = db.prepare(`
    INSERT INTO walkthrough_pins (walkthrough_id, property_id, task_id, title, description, room, action_type, severity, timestamp_sec, end_sec, x_pct, y_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Basement pins (0s - 16s)
  insertPin.run(wt1, prop1, t3, 'Diagonal Foundation Crack & Efflorescence', 'Active moisture wicking through diagonal poured-concrete wall crack; needs port epoxy seal + polyurethane foam injection.', 'Basement', 'fix', 'critical', 2.0, 9.5, 45, 49);
  insertPin.run(wt1, prop1, t6, 'Outdated 100A Gray Main Breaker Box', 'Undersized 100-amp service box lacking AFCI/GFCI capacity for modern kitchen & HVAC load; replace w/ 200A copper-bus panel.', 'Basement', 'replace', 'critical', 6.5, 15.0, 64, 46);
  insertPin.run(wt1, prop1, t5, 'Scaled Cast-Iron Waste Stack Joint', 'Heavy rust scaling & weeping hub joint on 4" vertical cast iron stack; replace w/ Schedule 40 PVC.', 'Basement', 'replace', 'high', 10.0, 15.8, 26, 54);

  // Exterior pins (16s - 32s)
  insertPin.run(wt1, prop1, t2, 'Sagging Bowed Gutter & Detached Downspout', 'Roof eave gutter bowed mid-span and dumping rainwater directly next to foundation stone.', 'Exterior', 'fix', 'high', 17.5, 25.5, 34, 20);
  insertPin.run(wt1, prop1, t4, 'Missing Deck Balusters & Weathered Rim/Ledger', 'Guardrail missing safety spindles (>4" code violation) and rim joist/ledger missing galvanized structural lag bolts.', 'Exterior Deck', 'replace', 'critical', 22.5, 31.5, 56, 63);

  // Kitchen pins (32s - 48s)
  insertPin.run(wt1, prop1, t5, 'Corroded Under-Sink P-Trap & Rotted Base', 'Active slow leak at corroded P-trap nut has rotted out particleboard sink base floor; open vertical drain stack on left.', 'Kitchen', 'fix', 'high', 33.5, 41.5, 42, 69);
  insertPin.run(wt1, prop1, t8, 'Ceiling Drywall Water Stain Near Light Box', 'Moisture stain around dated fluorescent ceiling box from prior upstairs bath valve seep; cut out & hang mold-resistant board.', 'Kitchen', 'fix', 'medium', 38.0, 46.5, 75, 9);
  insertPin.run(wt1, prop1, t10, '1970s Honey-Oak Cabinets & Laminate Tops', 'Worn cabinet doors, delaminating countertop edge, and unvented range exhaust; update w/ shaker cabinets & quartz.', 'Kitchen', 'update', 'cosmetic', 41.0, 47.8, 18, 24);

  // Bathroom pins (48s - 64s)
  insertPin.run(wt1, prop1, t9, 'Shattered Ceramic Floor Tile & Soft Subfloor', 'Cracked ceramic tiles radiating from toilet flange with spongy subfloor underneath; gut to joists, sister & lay porcelain tile.', 'Primary Bathroom', 'replace', 'high', 49.5, 57.5, 52, 86);
  insertPin.run(wt1, prop1, t7, 'Mildewed Fiberglass Surround & Corroded Valve', 'Aged single-handle shower trim seized with heavy mildew at surround seam; replace w/ brass mixing valve + cement backer.', 'Primary Bathroom', 'replace', 'high', 54.0, 62.5, 69, 38);
  insertPin.run(wt1, prop1, t11, 'Dated Oak Vanity & Tarnished Brass Faucet', 'Outdated 30" vanity and builders mirror; update to 36" shaker vanity w/ matte black fixtures after tile cures.', 'Primary Bathroom', 'update', 'cosmetic', 57.5, 63.8, 25, 68);

  // Walkthrough 2 pins (0-16s Kitchen, 16-32s Bath)
  insertPin.run(wt2, prop2, p2t1, 'Leaking Sink Trap & Swollen Cabinet Deck', 'Slow drip under double-basin stainless sink.', 'Kitchen', 'fix', 'high', 2.5, 13.5, 42, 69);
  insertPin.run(wt2, prop2, p2t2, 'Cracked Ceramic Floor Tile Around Toilet', 'Multiple fractured floor tiles needing waterproof LVP replacement.', 'Primary Bathroom', 'replace', 'high', 18.0, 27.0, 52, 86);
  insertPin.run(wt2, prop2, p2t3, 'Tarnished Brass Faucet & Vanity Update', 'Modernize vanity & mirror after LVP floor is installed.', 'Primary Bathroom', 'update', 'cosmetic', 23.0, 31.0, 25, 68);

  // Walkthrough 3 pins (0-16s Exterior, 16-32s Basement)
  insertPin.run(wt3, prop3, p3t1, 'Peeling Patio Slider Trim & Sill Flashing', 'Weathered wood trim peeling around sliding glass door.', 'Exterior', 'update', 'medium', 4.0, 14.0, 45, 31);

  // Seed Materials across Tasks
  const insertMat = db.prepare(`
    INSERT INTO task_materials (task_id, property_id, name, quantity, unit, unit_cost, supplier, purchased)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMat.run(t1, prop1, '3-Mil Contractor Demo Bags (50-ct Box)', 2, 'boxes', 29.97, 'Home Depot Pro', 1);
  insertMat.run(t2, prop1, '6" White Seamless K-Style Aluminum Gutter + Hidden Hangers', 28, 'lin ft', 6.50, 'ABC Supply', 1);
  insertMat.run(t2, prop1, '3x4 Corrugated Downspout + 6ft Hinged Extension', 1, 'kit', 48.00, 'ABC Supply', 1);
  insertMat.run(t3, prop1, 'Hydrophobic Polyurethane Crack Injection Kit (Ports + Epoxy Paste)', 2, 'kits', 145.00, 'RadonSeal / White Cap', 1);
  insertMat.run(t4, prop1, 'FastenMaster LedgerLOK 5" Structural Wood Screws (50-pk)', 1, 'box', 64.00, 'Home Depot Pro', 1);
  insertMat.run(t4, prop1, '2x10x16 Pressure-Treated Ground-Contact Rim Joist & Balusters', 1, 'lot', 218.00, '84 Lumber', 1);
  insertMat.run(t5, prop1, '4" x 10ft Schedule 40 Cellular Core PVC DWV Pipe + Cleanout Tee', 2, 'lengths', 46.50, 'Ferguson Plumbing', 1);
  insertMat.run(t5, prop1, '4" Heavy-Duty Stainless Shielded No-Hub Couplings', 4, 'ea', 19.80, 'Ferguson Plumbing', 1);
  insertMat.run(t5, prop1, '1-1/2" Heavy-Duty PVC P-Trap + Quarter-Turn Brass Angle Stops', 1, 'set', 38.00, 'Ferguson Plumbing', 0);
  insertMat.run(t6, prop1, 'Square D QO 200A 40-Space Indoor Main Breaker Load Center', 1, 'ea', 319.00, 'Graybar Electrical', 1);
  insertMat.run(t6, prop1, 'Dual-Function 20A AFCI/GFCI Plug-On Neutral Breakers', 6, 'ea', 58.00, 'Graybar Electrical', 1);
  insertMat.run(t6, prop1, '6/3 NM-B Copper Range Cable (50ft) + 12/2 Romex (250ft Roll)', 1, 'bundle', 310.00, 'Graybar Electrical', 0);
  insertMat.run(t7, prop1, 'Moen Posi-Temp Brass Pressure-Balanced Rough-In Valve', 1, 'ea', 129.00, 'Ferguson Plumbing', 0);
  insertMat.run(t7, prop1, 'Panasonic WhisperCeiling 110 CFM 0.3-Sone Exhaust Fan + 4" Insulated Duct', 1, 'kit', 184.00, 'Home Depot Pro', 0);
  insertMat.run(t8, prop1, '1/2" x 4x8 Mold-Tough Moisture Resistant Drywall + Setting Compound', 5, 'sheets', 18.90, 'Home Depot Pro', 0);
  insertMat.run(t9, prop1, '12x24 Matte Calacatta Porcelain Tile + Polymer-Modified Thinset', 145, 'sq ft', 4.25, 'Floor & Decor', 0);
  insertMat.run(t9, prop1, 'RedGard Waterproofing & Crack Prevention Membrane (3.5-Gal)', 1, 'pail', 168.00, 'Floor & Decor', 0);
  insertMat.run(t10, prop1, 'RTA Solid Birch White Shaker Kitchen Cabinet Package (11 Boxes)', 1, 'package', 3450.00, 'ProCraft Cabinetry', 0);
  insertMat.run(t10, prop1, '400 CFM Stainless Under-Cabinet Vented Range Hood', 1, 'ea', 265.00, 'Home Depot Pro', 0);
  insertMat.run(t11, prop1, '36" White Oak Shaker Vanity w/ Engineered Stone Top + Matte Black Faucet', 1, 'set', 690.00, 'Build.com', 0);
  insertMat.run(t11, prop1, 'Kohler Highline Elongated Chair-Height Toilet + Reinforced Waxless Seal', 1, 'set', 289.00, 'Ferguson Plumbing', 0);

  // Materials for Prop 2
  insertMat.run(p2t1, prop2, '1/2" Birch Plywood Under-Sink Deck + Zinsser BIN Primer + PVC Trap', 1, 'kit', 68.00, 'Home Depot Pro', 1);
  insertMat.run(p2t2, prop2, 'LifeProof 22-Mil Rigid Core Waterproof LVP Flooring', 65, 'sq ft', 3.79, 'Home Depot Pro', 1);

  // Seed Laborer Time Logs
  const insertLog = db.prepare(`
    INSERT INTO time_logs (task_id, property_id, user_id, work_date, hours, note, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Devon completed t1 (hourly @ $42/hr -> 8.0 hrs = $336)
  insertLog.run(t1, prop1, devonId, '2026-10-14', 4.5, 'Demoed kitchen sink base & cleared corroded PVC branches; bagged debris.', 1);
  insertLog.run(t1, prop1, devonId, '2026-10-15', 3.5, 'Chiseled up cracked ceramic bathroom floor tile & vacuumed subfloor.', 1);

  // Devon also logged hours on fixed-bid t2 & t3 for effective rate visibility
  insertLog.run(t2, prop1, devonId, '2026-10-16', 5.0, 'Removed bowed gutter, shimmed fascia pitch, hung 6" seamless gutter + extension.', 1);
  insertLog.run(t3, prop1, devonId, '2026-10-20', 2.5, 'Wire-wheeled foundation crack, drilled & epoxied 9 injection ports; curing overnight before foam injection.', 0);

  // Carlos working on t4 (hourly @ $62/hr) and t5 (hourly @ $62/hr before putting On Hold)
  insertLog.run(t4, prop1, carlosId, '2026-10-19', 3.5, 'Installed 14 structural LedgerLOK lag screws w/ butyl flashing tape along house band joist.', 1);
  insertLog.run(t5, prop1, carlosId, '2026-10-20', 2.0, 'Opened basement stack chase & tested main valve; discovered seized curb valve + clay lateral roots. Flagged On Hold.', 0);

  // Elena working on t6 (fixed payout $1,850, tracking hours)
  insertLog.run(t6, prop1, elenaId, '2026-10-21', 4.5, 'Mounted treated 3/4" backer board, prepped 200A Square D QO enclosure & pulled 6/3 range home-run.', 0);

  // Prop 2 logs
  insertLog.run(p2t2, prop2, devonId, '2026-10-21', 3.0, 'Pulled toilet, removed old ceramic tile & skimmed subfloor with Ardex Feather Finish.', 0);
}

export default db;
