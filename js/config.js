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
  EDGE_BOUNCE_MARGIN: 20,
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
  SWEEP_RANGE: 800,            // max range of the sweep cone (pixels, effectively whole canvas)
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

  // UI
  PLACE_THROTTLE_MS: 100,     // min ms between place events during drag
  MIN_TRAY_BUTTON_SIZE: 56,
};

export default CONFIG;
