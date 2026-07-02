// config.js — All tuning constants live here for easy balance passes.

const CONFIG = {
  // Canvas
  BG_COLOR: '#1a1a2e',
  GRID_COLOR: 'rgba(255,255,255,0.02)',

  // Simulation
  TICKS_PER_SECOND: 60,
  MAX_SPEED_MULTIPLIER: 1.0,   // applied to species base speed
  MAX_ENTITIES: 800,
  EAT_DISTANCE: 28,
  EDGE_BOUNCE_MARGIN: 60,
  EDGE_BOUNCE_STRENGTH: 4.0,    // wall-redirect strength — predictive, only active when heading toward edge
  REPRODUCTION_COOLDOWN: 900,  // ticks before same pair can spawn again

  // Hunger
  HUNGER_RATE: 0.05,           // hunger gained per tick (default; overridden by species.hungerRate)
  HUNGER_MAX: 100,             // death threshold
  HUNGER_SEEK_THRESHOLD: 60,   // hunger at which animals start seeking food — below this they're "full" and wander
  HUNGER_EAT_ZERO: 0,          // hunger value after eating
  HUNGER_FULL_COOLDOWN: 120,   // ticks after eating before animal can eat again (prevents instant re-eating)
  HUNGER_SENSE_RADIUS_MULTIPLIER: 2.5,  // max multiplier on senseRadius when starving (e.g. 2.5 means 3.5x base at max hunger)

  // Steering
  WANDER_STRENGTH: 0.3,
  WANDER_DIRECTION_CHANGE: 0.05, // radians per tick
  FLEE_STRENGTH: 4.0,
  SEEK_STRENGTH: 2.5,

  // Sweep scan — slow rotating long-range view cone
  SWEEP_RANGE: 300,            // max range of the sweep cone (pixels) — capped by species.senseRadius*3 in sweepScan
  SWEEP_ARC: Math.PI / 72,     // cone half-angle (~2.5°, 5° total width)
  SWEEP_SPEED: 0.003,           // radians per tick — full 360° sweep takes ~35 seconds at 60fps
  SWEEP_TARGET_LINGER: 0.8,    // fraction: how much of a sweep cycle to continue chasing after target lost
  SWEEP_INTEREST_DECAY: 0.02,  // how fast interest fades when target not in sweep (per tick)

  // Spatial hash
  GRID_CELL_SIZE: 160,         // should be >= largest senseRadius

  // Particles
  PARTICLE_LIFETIME: 40,       // ticks
  PARTICLE_SPEED: 1.5,

  // Persistence
  AUTOSAVE_INTERVAL: 5000,     // ms
  STORAGE_PREFIX: 'emojisandbox:',

  // Fire / Water / Plants
  FIRE_SPREAD_RADIUS: 60,
  FIRE_LIFESPAN: 300,          // ticks
  WATER_RADIUS: 80,
  WATER_LIFESPAN: 400,
  PLANT_SPAWN_RADIUS: 40,
  PLANT_MAX_FRUIT_NEARBY: 3,

  // Lightning
  LIGHTNING_INTERVAL: 600,     // ticks between lightning strikes (average)
  LIGHTNING_RADIUS: 50,        // kill radius of lightning strike
  LIGHTNING_STUN_RADIUS: 120,  // stun radius (slows entities)

  // Ice
  ICE_FREEZE_RADIUS: 70,       // radius in which ice slows entities
  ICE_SLOW_FACTOR: 0.2,        // speed multiplier when frozen
  ICE_LIFESPAN: 500,           // ticks before ice melts

  // Poison
  POISON_DAMAGE: 0.3,          // damage per tick from poison
  POISON_SPREAD_RADIUS: 50,    // radius poison cloud affects

  // Flocking
  FLOCK_RADIUS: 80,            // neighborhood radius for flocking
  FLOCK_SEPARATION: 30,        // desired separation distance
  FLOCK_ALIGNMENT: 0.08,       // alignment force weight
  FLOCK_COHESION: 0.04,        // cohesion force weight
  FLOCK_SEPARATION_FORCE: 0.6, // separation force weight

  // Special abilities
  DRAGON_FIRE_INTERVAL: 400,   // ticks between dragon fire breaths
  UNICORN_HEAL_RADIUS: 100,    // heal aura radius
  UNICORN_HEAL_AMOUNT: -15,    // hunger reduction from heal (negative = reduces hunger)
  SPIDER_WEB_RADIUS: 50,       // web trap radius
  SPIDER_WEB_DURATION: 200,    // how long webs last
  ZOMBIE_INFECT_RADIUS: 40,    // infection spread radius
  OCTOPUS_INK_RADIUS: 60,      // ink cloud radius
  OCTOPUS_INK_DURATION: 80,    // how long ink blinds

  // Reproduction
  REPRODUCTION_RADIUS: 60,     // how close two of same species need to be
  REPRODUCTION_CHANCE: 0.002,  // chance per tick when near mate

  // UI
  PLACE_THROTTLE_MS: 100,     // min ms between place events during drag
  MIN_TRAY_BUTTON_SIZE: 56,
  EMOJI_FONT: '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
};

export default CONFIG;
