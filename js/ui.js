// ui.js — Tray, top bar, input handling, save/load modal.
import CONFIG from './config.js';
import { SPECIES, TRAY_ORDER, TOOLS } from './rules.js';

let state = {
  selectedType: TRAY_ORDER[0],
  selectedTool: null,    // 'eraser' | 'clear' | null
  paused: false,
  speed: 1,
  muted: true,
  uiElements: {},
};

export function getUIState() {
  return state;
}

export function initUI(callbacks) {
  // Build tray buttons
  const trayScroll = document.getElementById('tray-scroll');

  for (const key of TRAY_ORDER) {
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
      if (callbacks.onClear) callbacks.onClear();
    }
  });
  trayScroll.appendChild(clearBtn);

  // Top bar
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
