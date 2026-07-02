// rules.js — Data-driven behavior tables. Adding a new emoji never requires
// new if-statements; just add an entry here.

const SPECIES = {
  // ── Food (static) ──────────────────────
  carrot:    { emoji: '🥕', category: 'food',       static: true },
  apple:     { emoji: '🍎', category: 'food',       static: true },
  berry:     { emoji: '🫐', category: 'food',       static: true },
  cheese:    { emoji: '🧀', category: 'food',       static: true },
  bread:     { emoji: '🍞', category: 'food',       static: true },
  grapes:    { emoji: '🍇', category: 'food',       static: true },
  banana:    { emoji: '🍌', category: 'food',       static: true },
  cherry:    { emoji: '🍒', category: 'food',       static: true },
  mushroom:  { emoji: '🍄', category: 'food',       static: true },
  watermelon:{ emoji: '🍉', category: 'food',       static: true },
  corn:      { emoji: '🌽', category: 'food',       static: true },

  // ── Herbivores ─────────────────────────
  rabbit:    { emoji: '🐰', category: 'herbivore',  speed: 1.6, senseRadius: 120, hungerRate: 0.04, flocking: true },
  mouse:     { emoji: '🐭', category: 'herbivore',  speed: 1.9, senseRadius: 120, hungerRate: 0.06, flocking: true },
  deer:      { emoji: '🦌', category: 'herbivore',  speed: 1.4, senseRadius: 170, hungerRate: 0.03 },
  sheep:     { emoji: '🐑', category: 'herbivore',  speed: 1.1, senseRadius: 110, hungerRate: 0.03, flocking: true },
  cow:       { emoji: '🐮', category: 'herbivore',  speed: 0.9, senseRadius: 140, hungerRate: 0.02 },
  turtle:    { emoji: '🐢', category: 'herbivore',  speed: 0.5, senseRadius: 100, hungerRate: 0.015 },
  koala:     { emoji: '🐨', category: 'herbivore',  speed: 0.7, senseRadius: 90,  hungerRate: 0.02 },
  elephant:  { emoji: '🐘', category: 'herbivore',  speed: 1.2, senseRadius: 250, hungerRate: 0.025, hp: 8 },
  giraffe:   { emoji: '🦒', category: 'herbivore',  speed: 1.3, senseRadius: 300, hungerRate: 0.025 },
  panda:     { emoji: '🐼', category: 'herbivore',  speed: 0.8, senseRadius: 100, hungerRate: 0.03 },

  // ── Predators ──────────────────────────
  fox:       { emoji: '🦊', category: 'predator',   speed: 2.2, senseRadius: 180, hungerRate: 0.07 },
  wolf:      { emoji: '🐺', category: 'predator',   speed: 2.0, senseRadius: 220, hungerRate: 0.05, flocking: true },
  cat:       { emoji: '🐈', category: 'predator',   speed: 1.8, senseRadius: 160, hungerRate: 0.06 },
  lion:      { emoji: '🦁', category: 'predator',   speed: 2.4, senseRadius: 260, hungerRate: 0.04 },
  tiger:     { emoji: '🐅', category: 'predator',   speed: 2.5, senseRadius: 240, hungerRate: 0.05 },
  bear:      { emoji: '🐻', category: 'predator',   speed: 1.6, senseRadius: 200, hungerRate: 0.035, hp: 6 },
  snake:     { emoji: '🐍', category: 'predator',   speed: 1.5, senseRadius: 130, hungerRate: 0.04, poison: true },
  eagle:     { emoji: '🦅', category: 'predator',   speed: 3.0, senseRadius: 350, hungerRate: 0.08 },
  shark:     { emoji: '🦈', category: 'predator',   speed: 2.8, senseRadius: 280, hungerRate: 0.06 },
  crocodile: { emoji: '🐊', category: 'predator',   speed: 1.7, senseRadius: 180, hungerRate: 0.04, hp: 5 },
  leopard:   { emoji: '🐆', category: 'predator',   speed: 2.6, senseRadius: 200, hungerRate: 0.06 },

  // ── Undead / Infection ────────────────
  zombie:    { emoji: '🧟', category: 'undead',     speed: 0.8, senseRadius: 160, hungerRate: 0.03, infectsTo: 'undead', infectDelay: 300 },
  ghost:     { emoji: '👻', category: 'undead',     speed: 1.6, senseRadius: 200, hungerRate: 0.05 },

  // ── Mythical ───────────────────────────
  dragon:    { emoji: '🐉', category: 'mythical',   speed: 2.2, senseRadius: 300, hungerRate: 0.04, breathesFire: true, hp: 10 },
  unicorn:   { emoji: '🦄', category: 'mythical',   speed: 2.0, senseRadius: 200, hungerRate: 0.04, heals: true },
  kraken:    { emoji: '🦑', category: 'mythical',   speed: 1.5, senseRadius: 250, hungerRate: 0.05, inks: true },

  // ── Bugs ───────────────────────────────
  spider:    { emoji: '🕷️', category: 'bug',        speed: 1.4, senseRadius: 140, hungerRate: 0.05, webs: true, poison: true },
  ant:       { emoji: '🐜', category: 'bug',        speed: 2.0, senseRadius: 80,  hungerRate: 0.08, flocking: true },
  bee:       { emoji: '🐝', category: 'bug',        speed: 2.5, senseRadius: 120, hungerRate: 0.07, poison: true },
  ladybug:   { emoji: '🐞', category: 'bug',        speed: 1.6, senseRadius: 100, hungerRate: 0.055 },
  cockroach: { emoji: '🪳', category: 'bug',        speed: 2.2, senseRadius: 90,  hungerRate: 0.04, hp: 4 },

  // ── Birds ──────────────────────────────
  parrot:    { emoji: '🦜', category: 'bird',       speed: 2.0, senseRadius: 150, hungerRate: 0.06 },
  penguin:   { emoji: '🐧', category: 'bird',       speed: 0.8, senseRadius: 110, hungerRate: 0.04, flocking: true },
  owl:       { emoji: '🦉', category: 'bird',       speed: 1.8, senseRadius: 280, hungerRate: 0.05 },
  swan:      { emoji: '🦢', category: 'bird',       speed: 1.4, senseRadius: 130, hungerRate: 0.045 },
  turkey:    { emoji: '🦃', category: 'bird',       speed: 1.0, senseRadius: 100, hungerRate: 0.05 },

  // ── Sea Creatures ──────────────────────
  fish:      { emoji: '🐟', category: 'sea',        speed: 2.0, senseRadius: 100, hungerRate: 0.06 },
  dolphin:   { emoji: '🐬', category: 'sea',        speed: 2.8, senseRadius: 220, hungerRate: 0.05, flocking: true },
  whale:     { emoji: '🐋', category: 'sea',        speed: 1.2, senseRadius: 300, hungerRate: 0.03, hp: 10 },
  octopus:   { emoji: '🐙', category: 'sea',        speed: 1.4, senseRadius: 160, hungerRate: 0.05, inks: true },

  // ── Plants ─────────────────────────────
  plant:     { emoji: '🌱', category: 'plant',      static: true, spawns: 'apple',  spawnEveryTicks: 600 },
  flower:    { emoji: '🌸', category: 'plant',      static: true, spawns: 'berry',  spawnEveryTicks: 500 },
  cactus:    { emoji: '🌵', category: 'plant',      static: true, spawns: 'cherry', spawnEveryTicks: 700 },
  tree:      { emoji: '🌳', category: 'plant',      static: true, spawns: 'apple',  spawnEveryTicks: 450 },
  mushroom_p: { emoji: '🍄', category: 'plant',     static: true, spawns: 'mushroom', spawnEveryTicks: 800, poison: true },

  // ── Elements ───────────────────────────
  fire:      { emoji: '🔥', category: 'fire',       static: true, spreadsTo: 'plant', radius: 60, lifespanTicks: 300 },
  water:     { emoji: '💧', category: 'water',      static: true, extinguishes: 'fire', radius: 80, lifespanTicks: 400 },
  wave:      { emoji: '🌊', category: 'water',      static: true, extinguishes: 'fire', radius: 60, lifespanTicks: 300 },
  lightning: { emoji: '⚡', category: 'lightning',   static: true, strikes: true, radius: 50, stunRadius: 120, lifespanTicks: 150 },
  ice:       { emoji: '🧊', category: 'ice',        static: true, freezes: true, radius: 70, lifespanTicks: 500 },
  tornado:   { emoji: '🌪️', category: 'tornado',    static: true, sucks: true, radius: 120, lifespanTicks: 350 },
  bomb:      { emoji: '💣', category: 'bomb',       static: true, explodes: true, radius: 100, lifespanTicks: 180 },
};

// What each category eats
const EATS = {
  herbivore:  ['food'],
  predator:   ['herbivore', 'bird', 'bug', 'sea'],
  undead:     ['herbivore', 'predator', 'bird', 'bug', 'sea', 'food'],
  mythical:   ['herbivore', 'predator', 'food'],
  bug:        ['food', 'plant'],
  bird:       ['food', 'bug'],
  sea:        ['food'],
};

// What each category flees from
const FLEES = {
  herbivore:  ['predator', 'mythical', 'undead', 'fire', 'bomb'],
  predator:   ['mythical', 'undead', 'fire', 'bomb'],
  undead:     ['fire', 'lightning', 'mythical'],
  mythical:   ['fire', 'bomb'],
  bug:        ['predator', 'bird', 'fire', 'undead'],
  bird:       ['predator', 'fire', 'bomb'],
  sea:        ['predator', 'undead', 'fire'],
};

// Ordered list for the tray UI
const TRAY_ORDER = [
  // Herbivores
  'rabbit', 'mouse', 'deer', 'sheep', 'cow', 'turtle', 'koala', 'elephant', 'giraffe', 'panda',
  // Predators
  'fox', 'wolf', 'cat', 'lion', 'tiger', 'bear', 'snake', 'eagle', 'shark', 'crocodile', 'leopard',
  // Undead
  'zombie', 'ghost',
  // Mythical
  'dragon', 'unicorn', 'kraken',
  // Bugs
  'spider', 'ant', 'bee', 'ladybug', 'cockroach',
  // Birds
  'parrot', 'penguin', 'owl', 'swan', 'turkey',
  // Sea
  'fish', 'dolphin', 'whale', 'octopus',
  // Food
  'carrot', 'apple', 'berry', 'cheese', 'bread', 'grapes', 'banana', 'cherry', 'mushroom', 'watermelon', 'corn',
  // Plants
  'plant', 'flower', 'cactus', 'tree', 'mushroom_p',
  // Elements
  'fire', 'water', 'wave', 'lightning', 'ice', 'tornado', 'bomb',
];

// Tool "species" — not real entities
const TOOLS = {
  eraser:  { emoji: '🧽', label: 'Erase' },
  clear:   { emoji: '🗑', label: 'Clear' },
};

export { SPECIES, EATS, FLEES, TRAY_ORDER, TOOLS };
