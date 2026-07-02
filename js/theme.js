// theme.js — Light / dark mode with auto-detection and manual toggle.
const STORAGE_KEY = 'emojisandbox:theme';

let currentTheme = 'dark'; // 'dark' | 'light'

export function initTheme() {
  // 1. Check localStorage for explicit user preference
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    currentTheme = stored;
  } else {
    // 2. Fall back to OS preference
    currentTheme = getSystemPreference();
  }

  applyTheme(currentTheme);

  // Listen for OS-level changes (only matters when no manual override is set)
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    // Only auto-switch if user hasn't manually picked a theme
    if (!localStorage.getItem(STORAGE_KEY)) {
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme);
    }
  });
}

export function getTheme() {
  return currentTheme;
}

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, currentTheme);
  applyTheme(currentTheme);
  return currentTheme;
}

export function getCanvasBgColor() {
  return currentTheme === 'dark' ? '#1a1a2e' : '#f0f2f5';
}

function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
