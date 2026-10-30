// Smart Residential Renovation Voice-to-Task & Realistic Estimator Engine
// Converts natural spoken walkthrough sentences into structured tasks with realistic time, materials, tools & build sequence.

const TASK_TEMPLATES = [
  {
    keywords: ['trash', 'boxes', 'clutter', 'clean out', 'cleanout', 'clear out', 'haul', 'debris', 'junk', 'empty'],
    action_type: 'fix',
    severity: 'high',
    trade_category: 'Demolition',
    sequence_phase: 1,
    est_hours_pro: 1.5,
    est_hours_skilled: 2.0,
    est_hours_diy: 2.5,
    rationale: 'Phase 1 First Step: Clear boxes, trash, and obstacles out of the room first so floors, walls, and ceilings are wide open to work on.',
    materials: [
      { name: 'Contractor Heavy-Duty 42-Gal Trash Bags (Box)', quantity: 1, unit: 'box', unit_cost: 19.97, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Work Gloves & Hand Truck / Dolly', category: 'hand', owned: true },
      { name: 'Push Broom & Dustpan', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['demo', 'tear out', 'rip out', 'rip up', 'gut', 'remove old carpet', 'pull carpet'],
    action_type: 'replace',
    severity: 'high',
    trade_category: 'Demolition',
    sequence_phase: 1,
    est_hours_pro: 2.0,
    est_hours_skilled: 3.0,
    est_hours_diy: 4.5,
    rationale: 'Phase 1 Selective Demo: Remove damaged finishes early so hidden subfloor or wall issues show up right away.',
    materials: [
      { name: '3-Mil Contractor Cleanup Bags', quantity: 1, unit: 'box', unit_cost: 22.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Pry Bar, Utility Knife & Hammer', category: 'hand', owned: true },
      { name: 'Dust Mask & Safety Glasses', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['subfloor', 'soft spot', 'rotted floor', 'joist', 'plywood floor'],
    action_type: 'replace',
    severity: 'critical',
    trade_category: 'Structural & Framing',
    sequence_phase: 2,
    est_hours_pro: 2.5,
    est_hours_skilled: 3.8,
    est_hours_diy: 6.0,
    rationale: 'Phase 2 Structural: Repair soft or rotted subfloor panels solid and level before any new flooring goes down.',
    materials: [
      { name: '23/32" Tongue-and-Groove Subfloor Plywood (4x8)', quantity: 2, unit: 'sheets', unit_cost: 36.00, supplier: 'Home Depot' },
      { name: 'Subfloor Construction Adhesive + 2" Deck Screws', quantity: 1, unit: 'lot', unit_cost: 18.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Circular Saw & Cordless Impact Driver', category: 'power', owned: true },
      { name: 'Pry Bar & Chalk Line', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['p-trap', 'under sink', 'sink leak', 'drain pipe', 'shutoff valve', 'angle stop', 'plumbing leak', 'pipe'],
    action_type: 'fix',
    severity: 'high',
    trade_category: 'Rough Plumbing',
    sequence_phase: 3,
    est_hours_pro: 1.0,
    est_hours_skilled: 1.5,
    est_hours_diy: 2.5,
    rationale: 'Phase 3 Plumbing: Fix water/drain leaks and test dry before repairing cabinets, drywall, or flooring.',
    materials: [
      { name: '1-1/2" PVC P-Trap Kit w/ Slip-Joint Washers', quantity: 1, unit: 'kit', unit_cost: 8.97, supplier: 'Home Depot' },
      { name: 'Quarter-Turn Brass Shutoff Valve + Braided Supply Line', quantity: 2, unit: 'ea', unit_cost: 14.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Channel-Lock Pliers & Bucket', category: 'hand', owned: true },
      { name: 'Pipe Wrench / Adjustable Wrench', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['faucet', 'kitchen sink', 'sprayer', 'garbage disposal', 'disposal'],
    action_type: 'replace',
    severity: 'medium',
    trade_category: 'Finish Plumbing & Trim',
    sequence_phase: 8,
    est_hours_pro: 1.0,
    est_hours_skilled: 1.5,
    est_hours_diy: 2.5,
    rationale: 'Phase 8 Finish Plumbing: Install new sink faucet or disposal after countertops and cabinet work are done.',
    materials: [
      { name: 'Pull-Down Kitchen Faucet w/ Supply Hoses', quantity: 1, unit: 'ea', unit_cost: 89.00, supplier: 'Home Depot' },
      { name: 'Plumber’s Putty / Silicone Sealant', quantity: 1, unit: 'tube', unit_cost: 6.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Basin Wrench & Adjustable Wrench', category: 'hand', owned: true },
      { name: 'Flashlight & Bucket', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['toilet', 'wax ring', 'flange', 'running toilet'],
    action_type: 'replace',
    severity: 'high',
    trade_category: 'Finish Plumbing & Trim',
    sequence_phase: 8,
    est_hours_pro: 1.0,
    est_hours_skilled: 1.5,
    est_hours_diy: 2.5,
    rationale: 'Phase 8 Finish Plumbing: Set toilet last right on top of the finished bathroom flooring.',
    materials: [
      { name: 'Elongated Chair-Height Toilet + Reinforced Wax Ring & Bolts', quantity: 1, unit: 'set', unit_cost: 169.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Adjustable Wrench, Putty Knife & Caulk Gun', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['outlet', 'switch', 'gfci', 'receptacle', 'cover plate', 'wall plate', 'plug'],
    action_type: 'replace',
    severity: 'medium',
    trade_category: 'Rough Electrical',
    sequence_phase: 8,
    est_hours_pro: 0.4,
    est_hours_skilled: 0.6,
    est_hours_diy: 1.0,
    rationale: 'Phase 8 Finish Electrical: Swap outlets, GFCIs, switches, and crisp new cover plates right after wall painting.',
    materials: [
      { name: '20A Tamper-Resistant GFCI / Decora Outlets + Wall Plates', quantity: 4, unit: 'ea', unit_cost: 6.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Non-Contact Voltage Tester & Wire Strippers', category: 'hand', owned: true },
      { name: 'Insulated Screwdriver', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['ceiling fan', 'light fixture', 'dome light', 'chandelier', 'fluorescent', 'led light', 'lighting'],
    action_type: 'replace',
    severity: 'medium',
    trade_category: 'Rough Electrical',
    sequence_phase: 8,
    est_hours_pro: 0.8,
    est_hours_skilled: 1.3,
    est_hours_diy: 2.0,
    rationale: 'Phase 8 Finish Fixtures: Hang new ceiling fan or LED light fixture AFTER ceiling stain-blocking and painting so paint never splatters the new fixture.',
    materials: [
      { name: '52" LED Ceiling Fan / Flushmount LED Fixture', quantity: 1, unit: 'ea', unit_cost: 99.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '6ft Step Ladder, Voltage Tester & Wire Strippers', category: 'hand', owned: true },
      { name: 'Cordless Screwdriver', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['ceiling', 'water stain', 'smoke stain', 'stained ceiling', 'popcorn'],
    action_type: 'fix',
    severity: 'medium',
    trade_category: 'Drywall & Waterproofing',
    sequence_phase: 5,
    est_hours_pro: 1.8,
    est_hours_skilled: 2.5,
    est_hours_diy: 3.8,
    rationale: 'Phase 5 Ceiling Prep & Paint: Always scrape, stain-block prime, and paint ceilings BEFORE walls and BEFORE new flooring so drips don’t matter.',
    materials: [
      { name: 'ZinsserKilz Stain-Blocking Ceiling Primer (1-Gal)', quantity: 1, unit: 'gal', unit_cost: 29.98, supplier: 'Home Depot' },
      { name: 'Flat White Ceiling Paint (1-Gal) + 3/8" Roller Cover', quantity: 1, unit: 'lot', unit_cost: 34.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '9" Paint Roller Frame + Extension Pole & Tray', category: 'hand', owned: true },
      { name: 'Drop Cloth & 6ft Step Ladder', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['hole', 'drywall', 'patch', 'sheetrock', 'crack in wall', 'mud', 'spackle'],
    action_type: 'fix',
    severity: 'medium',
    trade_category: 'Drywall & Waterproofing',
    sequence_phase: 5,
    est_hours_pro: 0.8,
    est_hours_skilled: 1.3,
    est_hours_diy: 2.0,
    rationale: 'Phase 5 Drywall & Patching: Patch, sand, and spot-prime wall blemishes before rolling room paint.',
    materials: [
      { name: 'Fast-Dry Joint Compound + Self-Adhesive Mesh Patch', quantity: 1, unit: 'kit', unit_cost: 14.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '6" Putty/Taping Knife & Sanding Sponge', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['cabinet door', 'hinge', 'knob', 'pull', 'handle', 'drawer', 'rehang cabinet'],
    action_type: 'fix',
    severity: 'cosmetic',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 6,
    est_hours_pro: 1.0,
    est_hours_skilled: 1.5,
    est_hours_diy: 2.5,
    rationale: 'Phase 6 Cabinetry: Adjust/re-hang cabinet doors and install soft-close hinges & pulls before final kitchen cleanup.',
    materials: [
      { name: 'Soft-Close Cabinet Hinges + Brushed Nickel/Black Pulls (Pack)', quantity: 1, unit: 'pack', unit_cost: 34.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Cordless Drill/Driver + Cabinet Hardware Jig', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['paint cabinet', 'refinish cabinet', 'spray cabinet'],
    action_type: 'update',
    severity: 'cosmetic',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 6,
    est_hours_pro: 4.5,
    est_hours_skilled: 6.5,
    est_hours_diy: 10.0,
    rationale: 'Phase 6 Cabinetry: Degrease, scuff-sand, bonding-prime, and enamel-paint cabinets before laying new floors.',
    materials: [
      { name: 'Krud Kutter Degreaser + Bonding Primer + Urethane Cabinet Enamel', quantity: 1, unit: 'kit', unit_cost: 88.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '4" Mohair/Foam Cabinet Rollers, Angled Brush & Sanding Pads', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['replace cabinet', 'new cabinet', 'shaker cabinet'],
    action_type: 'replace',
    severity: 'high',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 6,
    est_hours_pro: 6.0,
    est_hours_skilled: 9.0,
    est_hours_diy: 14.0,
    rationale: 'Phase 6 Cabinetry: Level and anchor wall & base cabinets after drywall/ceiling paint and before countertops.',
    materials: [
      { name: 'In-Stock Shaker Kitchen Base & Wall Cabinets', quantity: 1, unit: 'set', unit_cost: 1450.00, supplier: 'Home Depot' },
      { name: 'Cabinet Screws & Composite Shims', quantity: 1, unit: 'box', unit_cost: 16.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '4ft Level, Stud Finder & Cordless Drill', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['countertop', 'counter', 'laminate', 'butcher block', 'quartz'],
    action_type: 'update',
    severity: 'medium',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 7,
    est_hours_pro: 2.5,
    est_hours_skilled: 3.8,
    est_hours_diy: 6.0,
    rationale: 'Phase 7 Countertops: Install countertops after base cabinets are anchored level and before hooking up sink/faucet.',
    materials: [
      { name: 'Pre-Formed Laminate or Butcher Block Countertop', quantity: 1, unit: 'lot', unit_cost: 285.00, supplier: 'Home Depot' },
      { name: '100% Kitchen & Bath Silicone Caulk', quantity: 1, unit: 'tube', unit_cost: 8.50, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Jigsaw (for Sink Cutout), Drill & Caulk Gun', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['paint wall', 'paint room', 'paint kitchen', 'repaint', 'interior paint', 'coat of paint'],
    action_type: 'update',
    severity: 'cosmetic',
    trade_category: 'Paint & Exterior Finish',
    sequence_phase: 7,
    est_hours_pro: 2.2,
    est_hours_skilled: 3.2,
    est_hours_diy: 5.0,
    rationale: 'Phase 7 Paint: Cut-in and roll wall paint AFTER drywall patching & ceiling paint, and BEFORE installing new flooring & trim.',
    materials: [
      { name: 'Behr Eggshell Washable Interior Paint (1-Gal) + Painter’s Tape', quantity: 2, unit: 'gal', unit_cost: 36.98, supplier: 'Home Depot' }
    ],
    tools: [
      { name: '2" Angled Sash Brush, 9" Roller, Tray & Drop Cloth', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['floor', 'lvp', 'vinyl plank', 'laminate floor', 'peel and stick', 'linoleum', 'tile floor'],
    action_type: 'replace',
    severity: 'high',
    trade_category: 'Tile & Flooring',
    sequence_phase: 7,
    est_hours_pro: 3.5,
    est_hours_skilled: 5.0,
    est_hours_diy: 8.0,
    rationale: 'Phase 7 Flooring: Lay waterproof click-lock LVP flooring AFTER messy overhead ceiling & wall painting is finished.',
    materials: [
      { name: 'Waterproof Click-Lock Vinyl Plank Flooring (LVP)', quantity: 165, unit: 'sq ft', unit_cost: 2.49, supplier: 'Home Depot' },
      { name: 'Quarter-Round Shoe Molding (Primed)', quantity: 48, unit: 'lin ft', unit_cost: 0.98, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Utility Knife / LVP Cutter, Tapping Block, Pull Bar & Rubber Mallet', category: 'hand', owned: true },
      { name: 'Tape Measure & Spacers', category: 'hand', owned: true }
    ]
  },
  {
    keywords: ['baseboard', 'trim', 'molding', 'quarter round', 'casing', 'door trim'],
    action_type: 'update',
    severity: 'cosmetic',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 8,
    est_hours_pro: 1.5,
    est_hours_skilled: 2.2,
    est_hours_diy: 3.5,
    rationale: 'Phase 8 Finish Trim: Nail baseboards/shoe molding right over the expansion gap of the new flooring, caulk & touch-up.',
    materials: [
      { name: 'Primed Baseboard / Shoe Trim + Painter’s Caulk', quantity: 50, unit: 'lin ft', unit_cost: 1.45, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Miter Saw (or Miter Box) & 18-Gauge Brad Nailer', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['window', 'blinds', 'curtain', 'screen', 'window sill'],
    action_type: 'update',
    severity: 'cosmetic',
    trade_category: 'Cabinetry & Finish',
    sequence_phase: 8,
    est_hours_pro: 0.6,
    est_hours_skilled: 1.0,
    est_hours_diy: 1.5,
    rationale: 'Phase 8 Final Punch: Hang fresh 2" faux-wood blinds and check window locks/screens at the very end so they stay dust-free.',
    materials: [
      { name: '2" Cordless Faux-Wood Window Blinds', quantity: 2, unit: 'ea', unit_cost: 38.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Cordless Drill & Tape Measure', category: 'power', owned: true }
    ]
  },
  {
    keywords: ['stove', 'oven', 'range', 'microwave', 'fridge', 'refrigerator', 'appliance', 'range hood', 'vent'],
    action_type: 'update',
    severity: 'medium',
    trade_category: 'Finish Plumbing & Trim',
    sequence_phase: 8,
    est_hours_pro: 1.0,
    est_hours_skilled: 1.5,
    est_hours_diy: 2.0,
    rationale: 'Phase 8 Appliances: Move in, level, and test stove, microwave, hood, and refrigerator last after floors and paint cure.',
    materials: [
      { name: 'Appliance Cord / Range Hood Filter & Degreaser', quantity: 1, unit: 'kit', unit_cost: 28.00, supplier: 'Home Depot' }
    ],
    tools: [
      { name: 'Appliance Dolly, Torpedo Level & Screwdriver', category: 'hand', owned: true }
    ]
  }
];

function cleanSentenceToTitle(rawText) {
  let s = String(rawText || '')
    .trim()
    .replace(/^(okay|ok|so|and|then|next|also|over here|right here|uh|um|we need to|i need to|let's|lets|have to|gotta)\s+/i, '')
    .replace(/^(we should|you need to|someone needs to)\s+/i, '')
    .replace(/[.?!]+$/, '')
    .trim();
  if (!s) return 'General Room Repair';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function estimateSingleTaskFromSpeech(rawSentence, roomDefault = 'Kitchen') {
  const lower = String(rawSentence || '').toLowerCase();

  // Detect room if mentioned in speech
  let room = roomDefault;
  const roomMap = [
    ['kitchen', 'Kitchen'],
    ['bathroom', 'Bathroom'],
    ['bath', 'Bathroom'],
    ['bedroom', 'Bedroom'],
    ['living room', 'Living Room'],
    ['hallway', 'Hallway'],
    ['basement', 'Basement'],
    ['laundry', 'Laundry Room'],
    ['exterior', 'Exterior'],
    ['porch', 'Porch / Deck'],
    ['deck', 'Porch / Deck'],
    ['yard', 'Exterior']
  ];
  for (const [kw, label] of roomMap) {
    if (lower.includes(kw)) {
      room = label;
      break;
    }
  }

  // Find best matching template (score by matched keyword count/length)
  let bestTemplate = null;
  let bestScore = 0;
  for (const tpl of TASK_TEMPLATES) {
    let score = 0;
    for (const kw of tpl.keywords) {
      if (lower.includes(kw)) {
        score += kw.length + 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = tpl;
    }
  }

  // Action override if user explicitly said fix / replace / paint / update
  let action_type = bestTemplate?.action_type || 'fix';
  if (/\b(replace|new|swap|install new|tear out|rip out)\b/.test(lower)) action_type = 'replace';
  else if (/\b(paint|update|modernize|upgrade|refinish)\b/.test(lower)) action_type = 'update';
  else if (/\b(fix|repair|patch|tighten|clean|clear|seal|caulk)\b/.test(lower)) action_type = 'fix';

  // Scale hours slightly if user says "small / touch up / one" vs "all / whole / entire"
  let scale = 1.0;
  if (/\b(small|tiny|little|minor|quick|one|single|touch up)\b/.test(lower)) scale = 0.65;
  if (/\b(whole house|entire|every|all of the|major)\b/.test(lower)) scale = 1.35;

  const basePro = bestTemplate?.est_hours_pro ?? 1.0;
  const baseSkilled = bestTemplate?.est_hours_skilled ?? 1.5;
  const baseDiy = bestTemplate?.est_hours_diy ?? 2.5;

  const est_hours_pro = Math.max(0.5, Number((basePro * scale).toFixed(1)));
  const est_hours_skilled = Math.max(0.5, Number((baseSkilled * scale).toFixed(1)));
  const est_hours_diy = Math.max(0.8, Number((baseDiy * scale).toFixed(1)));

  const title = cleanSentenceToTitle(rawSentence);
  const fixed_pay_amount = Math.round(est_hours_skilled * 25); // Realistic $25/hr helper equivalent

  return {
    title,
    description: `Homeowner walkthrough note: "${String(rawSentence).trim()}"`,
    room,
    action_type,
    severity: bestTemplate?.severity || 'medium',
    trade_category: bestTemplate?.trade_category || 'General Carpentry',
    sequence_phase: bestTemplate?.sequence_phase || 6,
    sequence_rationale:
      bestTemplate?.rationale ||
      'Scheduled in logical room renovation sequence so messy prep comes before final finishes.',
    est_hours_pro,
    est_hours_skilled,
    est_hours_diy,
    pay_type: 'hourly',
    fixed_pay_amount,
    materials: bestTemplate?.materials || [
      { name: 'General Fasteners / Repair Supplies', quantity: 1, unit: 'lot', unit_cost: 20.0, supplier: 'Home Depot' }
    ],
    tools: (bestTemplate?.tools || [
      { name: 'Basic Hand Tool Kit & Cordless Drill', category: 'hand', owned: true }
    ]).map((t, i) => ({
      id: `tl-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      ...t
    }))
  };
}

export function splitTranscriptIntoStatements(transcriptText) {
  if (!transcriptText || !transcriptText.trim()) return [];
  // Split spoken walkthrough transcript on sentence breaks and natural transition phrases
  const normalized = transcriptText
    .replace(/\s+/g, ' ')
    .replace(/\b(and then|next we need to|also we need to|after that|then we need to|plus we need to|secondly|thirdly)\b/gi, '. ')
    .replace(/;\s*/g, '. ');

  const rawParts = normalized
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.replace(/^[,\-•\d.)\s]+/, '').trim())
    .filter((s) => s.length >= 5);

  // Filter out pure filler greetings ("Okay I am in the kitchen taking a look") unless it contains an action/item
  const actionOrNounRegex = /\b(fix|replace|paint|prime|clean|clear|remove|install|patch|put|hang|swap|repair|change|caulk|sand|trash|boxes|ceiling|floor|cabinet|sink|faucet|light|fan|window|wall|door|trim|stove|fridge|microwave|outlet|switch|tile|counter)\b/i;

  const meaningful = rawParts.filter((p) => actionOrNounRegex.test(p));
  return meaningful.length > 0 ? meaningful : rawParts;
}
