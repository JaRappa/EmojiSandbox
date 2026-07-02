// main.js — Boot, game loop, resize, input handling.
import CONFIG from './config.js';
import { SPECIES } from './rules.js';
import SpatialGrid from './grid.js';
import { createEntity, updateEntity } from './entity.js';
import { render, addParticle, clearParticles, getParticles } from './render.js';
import { autosave, loadAutosave, saveSlot, loadSlot, deleteSlot, listSlots } from './storage.js';
import { getUIState, initUI, updateEntityCounter } from './ui.js';
import { initTheme, getTheme, toggleTheme, getCanvasBgColor } from './theme.js';

// ── State ────────────────────────────────
let entities = [];
let tick = 0;
let liveCount = 0;
let grid = new SpatialGrid();
let canvas, ctx;
let lastAutosave = 0;
let animationId;

// ── Boot ─────────────────────────────────
function boot() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d', { desynchronized: true }) || canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  initUI({
    onClear: () => {
      entities.length = 0;
      liveCount = 0;
      clearParticles();
      tick = 0;
    },
  });

  // Theme
  initTheme();
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.textContent = getTheme() === 'dark' ? '🌙' : '☀️';
    btnTheme.addEventListener('click', () => {
      const newTheme = toggleTheme();
      btnTheme.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });
  }

  // Try to restore autosave
  const saved = loadAutosave();
  if (saved && saved.entities) {
    entities = saved.entities.map(deserializeEntity);
    tick = saved.tick || 0;
  }
  liveCount = entities.length;

  // Input handling
  setupInput();

  // Game loop
  lastAutosave = performance.now();
  loop(performance.now());
}

// ── Game Loop ────────────────────────────
const FIXED_DT = 1000 / CONFIG.TICKS_PER_SECOND;
let accumulator = 0;

function loop(now) {
  animationId = requestAnimationFrame(loop);

  const ui = getUIState();
  if (ui.paused) {
    render(ctx, canvas, entities, true);
    return;
  }

  const dt = Math.min(now - (loop._lastNow || now), 100); // cap to prevent spiral
  loop._lastNow = now;

  accumulator += dt * ui.speed;

  // At high entity counts, cap max ticks per frame to prevent death spiral
  const maxUpdates = entities.length > 600 ? 3 : entities.length > 300 ? 5 : 10;

  let updates = 0;
  while (accumulator >= FIXED_DT && updates < maxUpdates) {
    accumulator -= FIXED_DT;
    tick++;
    updateWorld();
    updates++;
  }

  // If falling behind, skip accumulator to catch up
  if (accumulator > FIXED_DT * maxUpdates) {
    accumulator = FIXED_DT * maxUpdates;
  }

  // Autosave
  if (now - lastAutosave > CONFIG.AUTOSAVE_INTERVAL) {
    lastAutosave = now;
    autosave(tick, entities);
  }

  updateEntityCounter(liveCount);
  render(ctx, canvas, entities, false);
}

// ── World Update ─────────────────────────
function updateWorld() {
  // Rebuild spatial grid
  grid.clear();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!e.dead) grid.insert(e);
  }

  // Update each entity
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.dead) continue;
    updateEntity(e, grid, canvas._cssWidth || canvas.width, canvas._cssHeight || canvas.height, entities, FIXED_DT);

    // Spawn particle on eat — throttle at high entity counts
    if (e._ateAt) {
      if (entities.length < CONFIG.PERF_TIER_HIGH) {
        addParticle(e._ateAt.x, e._ateAt.y, '💨');
      }
      e._ateAt = null;
    }

    // Explosion particles — reduce count at high entity counts
    if (e._explodedAt) {
      if (entities.length < CONFIG.PERF_TIER_HIGH) {
        for (let j = 0; j < 15; j++) {
          addParticle(e._explodedAt.x, e._explodedAt.y, '💥');
        }
      }
      e._explodedAt = null;
      e.dead = true;
    }
  }

  // Remove dead entities — filter in-place, track live count
  let writeIdx = 0;
  for (let i = 0; i < entities.length; i++) {
    if (!entities[i].dead) {
      entities[writeIdx++] = entities[i];
    }
  }
  entities.length = writeIdx;
  liveCount = writeIdx;

  // Enforce max entities
  if (entities.length > CONFIG.MAX_ENTITIES) {
    entities.splice(0, entities.length - CONFIG.MAX_ENTITIES);
    liveCount = entities.length;
  }
}

// ── Canvas Resize ────────────────────────
function resizeCanvas() {
  const dpr = 1; // Cap at 1x for performance (emoji sprites already look fine)
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  // Store CSS dimensions for renderer to use (drawing happens in CSS pixels)
  const oldW = canvas._cssWidth || w;
  const oldH = canvas._cssHeight || h;

  // Scale entity positions proportionally when canvas actually changes size
  if (oldW !== w || oldH !== h) {
    const sx = w / oldW;
    const sy = h / oldH;
    for (const e of entities) {
      e.x *= sx;
      e.y *= sy;
    }
  }

  canvas._cssWidth = w;
  canvas._cssHeight = h;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ── Input Handling ───────────────────────
function setupInput() {
  let isDown = false;
  let lastPlaceTime = 0;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleDown = (e) => {
    e.preventDefault();
    isDown = true;
    const pos = getPos(e);
    handlePlace(pos.x, pos.y);
    lastPlaceTime = performance.now();
  };

  const handleMove = (e) => {
    e.preventDefault();
    if (!isDown) return;
    const now = performance.now();
    if (now - lastPlaceTime < CONFIG.PLACE_THROTTLE_MS) return;
    lastPlaceTime = now;
    const pos = getPos(e);
    handlePlace(pos.x, pos.y);
  };

  const handleUp = (e) => {
    e.preventDefault();
    isDown = false;
  };

  canvas.addEventListener('mousedown', handleDown);
  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseup', handleUp);
  canvas.addEventListener('mouseleave', handleUp);
  canvas.addEventListener('touchstart', handleDown, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  canvas.addEventListener('touchend', handleUp);
}

function handlePlace(x, y) {
  const ui = getUIState();

  if (ui.selectedTool === 'eraser') {
    // Remove entities near point
    const targets = grid.queryRaw(x, y, 40);
    for (let i = 0; i < targets.length; i++) {
      targets[i].entity.dead = true;
    }
    return;
  }

  if (ui.selectedTool === 'clear') return;

  // Place entity
  const type = ui.selectedType;
  if (!SPECIES[type]) return;

  if (entities.length >= CONFIG.MAX_ENTITIES) {
    // Remove oldest to make room
    entities.shift();
  }

  const entity = createEntity(type, x, y);
  if (entity) {
    entities.push(entity);
    addParticle(x, y, '✨');
  }
}

// ── Deserialize ──────────────────────────
function deserializeEntity(data) {
  const entity = createEntity(data.type, data.x, data.y);
  if (!entity) return null;
  entity.id = data.id;
  entity.x = data.x;
  entity.y = data.y;
  entity.vx = data.vx || 0;
  entity.vy = data.vy || 0;
  entity.hunger = data.hunger || 0;
  entity.age = data.age || 0;
  entity.spawnTimer = data.spawnTimer || 0;
  entity.lifespan = data.lifespan ?? -1;
  return entity;
}

// ── Start ────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
