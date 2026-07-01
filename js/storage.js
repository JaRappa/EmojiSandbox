// storage.js — Save/load/autosave via localStorage.
import CONFIG from './config.js';

const STORAGE_AVAILABLE = typeof localStorage !== 'undefined';

export function saveSlot(name, tick, entities) {
  if (!STORAGE_AVAILABLE) return false;
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      name,
      tick,
      entities: entities.filter(e => !e.dead).map(serializeEntity),
    };
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'save:' + name, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed:', e);
    return false;
  }
}

export function loadSlot(name) {
  if (!STORAGE_AVAILABLE) return null;
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'save:' + name);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

export function deleteSlot(name) {
  if (!STORAGE_AVAILABLE) return;
  localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'save:' + name);
}

export function listSlots() {
  if (!STORAGE_AVAILABLE) return [];
  const slots = [];
  const prefix = CONFIG.STORAGE_PREFIX + 'save:';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const name = key.slice(prefix.length);
      try {
        const data = JSON.parse(localStorage.getItem(key));
        slots.push({ name, savedAt: data.savedAt, count: data.entities?.length ?? 0 });
      } catch (e) { /* skip corrupt */ }
    }
  }
  slots.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return slots;
}

export function autosave(tick, entities) {
  if (!STORAGE_AVAILABLE) return;
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      name: 'autosave',
      tick,
      entities: entities.filter(e => !e.dead).map(serializeEntity),
    };
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'autosave', JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

export function loadAutosave() {
  if (!STORAGE_AVAILABLE) return null;
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'autosave');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function serializeEntity(e) {
  return {
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    vx: e.vx,
    vy: e.vy,
    hunger: e.hunger,
    age: e.age,
    spawnTimer: e.spawnTimer,
    lifespan: e.lifespan,
  };
}
