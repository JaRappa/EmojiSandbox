// ui.js — Tray, top bar, input handling, save/load modal.
import CONFIG from './config.js';
import { SPECIES, TRAY_ORDER, TOOLS } from './rules.js';

// UI-level category groups (can combine multiple rules categories under one tab)
const UI_CATEGORIES = [
  { id: 'herbivore', label: '🦌 Herbivores', cats: ['herbivore'] },
  { id: 'predator',  label: '🦊 Predators',  cats: ['predator'] },
  { id: 'undead',    label: '🧟 Undead',     cats: ['undead'] },
  { id: 'mythical',  label: '🐉 Mythical',   cats: ['mythical'] },
  { id: 'bug',       label: '🐜 Bugs',       cats: ['bug'] },
  { id: 'bird',      label: '🦅 Birds',      cats: ['bird'] },
  { id: 'sea',       label: '🐟 Sea',        cats: ['sea'] },
  { id: 'food',      label: '🍎 Food',       cats: ['food'] },
  { id: 'plant',     label: '🌱 Plants',     cats: ['plant'] },
  { id: 'elements',  label: '⚡ Elements',   cats: ['fire', 'water', 'lightning', 'ice', 'tornado', 'bomb'] },
];

let state = {
  selectedType: TRAY_ORDER[0],
  selectedTool: null,    // 'eraser' | 'clear' | null
  activeCategory: 'all', // 'all' or a category key
  paused: false,
  speed: 1,
  muted: true,
  uiElements: {},
};

export function getUIState() {
  return state;
}

export function initUI(callbacks) {
  // ── Category bar ──────────────────────
  const catScroll = document.getElementById('category-scroll');

  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn active';
  allBtn.textContent = 'All';
  allBtn.dataset.cat = 'all';
  allBtn.addEventListener('click', () => {
    state.activeCategory = 'all';
    updateCategoryButtons();
    rebuildTray();
    // keep current selection if visible, else pick first
    if (!isTypeVisible(state.selectedType)) {
      state.selectedType = getFirstVisible();
      state.selectedTool = null;
    }
    updateSelection();
  });
  catScroll.appendChild(allBtn);

  for (const cat of UI_CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    btn.addEventListener('click', () => {
      state.activeCategory = cat.id;
      updateCategoryButtons();
      rebuildTray();
      if (!isTypeVisible(state.selectedType)) {
        state.selectedType = getFirstVisible();
        state.selectedTool = null;
      }
      updateSelection();
    });
    catScroll.appendChild(btn);
  }

  // ── Build initial tray ────────────────
  const trayScroll = document.getElementById('tray-scroll');
  buildTrayContent(trayScroll);

  // ── Top bar ───────────────────────────
  const btnPause = document.getElementById('btn-pause');
  const btnSpeed = document.getElementById('btn-speed');
  const btnMute = document.getElementById('btn-mute');
  const entityCounter = document.getElementById('entity-counter');

  btnPause.addEventListener('click', () => {
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? '▶️' : '⏯️';
  });

  btnSpeed.addEventListener('click', () => {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
    btnSpeed.textContent = state.speed + 'x';
  });

  btnMute.addEventListener('click', () => {
    state.muted = !state.muted;
    btnMute.textContent = state.muted ? '🔇' : '🔊';
  });

  state.uiElements = { btnPause, btnSpeed, btnMute, entityCounter, trayScroll };
  state._callbacks = callbacks;
}

// ── Tray helpers ─────────────────────────

function getVisibleTypes() {
  if (state.activeCategory === 'all') return TRAY_ORDER;
  const group = UI_CATEGORIES.find(c => c.id === state.activeCategory);
  if (!group) return [];
  return TRAY_ORDER.filter(k => group.cats.includes(SPECIES[k].category));
}

function isTypeVisible(type) {
  if (state.activeCategory === 'all') return true;
  const group = UI_CATEGORIES.find(c => c.id === state.activeCategory);
  if (!group) return false;
  return group.cats.includes(SPECIES[type].category);
}

function getFirstVisible() {
  return getVisibleTypes()[0] || TRAY_ORDER[0];
}

function updateCategoryButtons() {
  const catScroll = document.getElementById('category-scroll');
  for (const btn of catScroll.querySelectorAll('.cat-btn')) {
    btn.classList.toggle('active', btn.dataset.cat === state.activeCategory);
  }
}

function buildTrayContent(trayScroll) {
  trayScroll.innerHTML = '';

  for (const key of getVisibleTypes()) {
    const sp = SPECIES[key];
    const btn = document.createElement('button');
    btn.className = 'tray-btn';
    btn.textContent = sp.emoji;
    btn.title = key;
    btn.dataset.type = key;
    if (key === state.selectedType) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      state.selectedType = key;
      state.selectedTool = null;
      updateSelection();
    });
    trayScroll.appendChild(btn);
  }

  // Eraser tool
  const eraserBtn = document.createElement('button');
  eraserBtn.className = 'tray-btn eraser';
  eraserBtn.textContent = TOOLS.eraser.emoji;
  eraserBtn.title = 'Eraser';
  eraserBtn.dataset.tool = 'eraser';
  eraserBtn.addEventListener('click', () => {
    state.selectedTool = state.selectedTool === 'eraser' ? null : 'eraser';
    updateSelection();
  });
  trayScroll.appendChild(eraserBtn);

  // Clear tool
  const clearBtn = document.createElement('button');
  clearBtn.className = 'tray-btn eraser';
  clearBtn.textContent = TOOLS.clear.emoji;
  clearBtn.title = 'Clear All';
  clearBtn.dataset.tool = 'clear';
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all entities?')) {
      state.selectedTool = null;
      updateSelection();
      if (state._callbacks && state._callbacks.onClear) state._callbacks.onClear();
    }
  });
  trayScroll.appendChild(clearBtn);
}

function rebuildTray() {
  const trayScroll = state.uiElements.trayScroll;
  if (!trayScroll) return;
  buildTrayContent(trayScroll);
}

function updateSelection() {
  const trayScroll = state.uiElements.trayScroll;
  if (!trayScroll) return;
  for (const btn of trayScroll.querySelectorAll('.tray-btn')) {
    btn.classList.remove('selected');
    if (
      (btn.dataset.type && btn.dataset.type === state.selectedType && !state.selectedTool) ||
      (btn.dataset.tool && btn.dataset.tool === state.selectedTool)
    ) {
      btn.classList.add('selected');
    }
  }
}

export function updateEntityCounter(count) {
  const el = state.uiElements.entityCounter;
  if (el) el.textContent = count + ' entities';
}
