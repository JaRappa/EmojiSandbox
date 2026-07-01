// rules.js — Data-driven behavior tables. Adding a new emoji never requires
// new if-statements; just add an entry here.

const SPECIES = {
  // ── Food (static) ──────────────────────
  carrot:   { emoji: '🥕', category: 'food',      static: true },
  apple:    { emoji: '🍎', category: 'food',      static: true },
  berry:    { emoji: '🫐', category: 'food',      static: true },

  // ── Herbivores ─────────────────────────
  rabbit:   { emoji: '🐰', category: 'herbivore', speed: 1.6, senseRadius: 120, hungerRate: 0.04 },
  mouse:    { emoji: '🐭', category: 'herbivore', speed: 1.9, senseRadius: 120, hungerRate: 0.06 },
  deer:     { emoji: '🦌', category: 'herbivore', speed: 1.4, senseRadius: 170, hungerRate: 0.03 },

  // ── Predators ──────────────────────────
  fox:      { emoji: '🦊', category: 'predator',  speed: 2.2, senseRadius: 180, hungerRate: 0.07 },
  wolf:     { emoji: '🐺', category: 'predator',  speed: 2.0, senseRadius: 220, hungerRate: 0.05 },
  cat:      { emoji: '🐈', category: 'predator',  speed: 1.8, senseRadius: 160, hungerRate: 0.06 },

  // ── Plants ─────────────────────────────
  plant:    { emoji: '🌱', category: 'plant',     static: true, spawns: 'apple', spawnEveryTicks: 600 },

  // ── Elements ───────────────────────────
  fire:     { emoji: '🔥', category: 'fire',      static: true, spreadsTo: 'plant', radius: 60, lifespanTicks: 300 },
  water:    { emoji: '💧', category: 'water',     static: true, extinguishes: 'fire', radius: 80, lifespanTicks: 400 },
};

// What each category eats
const EATS = {
  herbivore: ['food'],
  predator:  ['herbivore'],
};

// What each category flees from
const FLEES = {
  herbivore: ['predator'],
};

// Ordered list for the tray UI
const TRAY_ORDER = [
  'rabbit', 'mouse', 'deer',
  'fox', 'wolf', 'cat',
  'carrot', 'apple', 'berry',
  'plant',
  'fire', 'water',
];

// Tool "species" — not real entities
const TOOLS = {
  eraser:  { emoji: '🧽', label: 'Erase' },
  clear:   { emoji: '🗑', label: 'Clear' },
};

export { SPECIES, EATS, FLEES, TRAY_ORDER, TOOLS };
