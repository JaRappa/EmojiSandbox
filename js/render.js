// render.js — Canvas rendering: entities, particles, grid overlay.
import CONFIG from './config.js';
import { getCanvasBgColor } from './theme.js';

let particleArr = [];

// ── Sprite cache: pre-render emojis to offscreen canvases ──
const spriteCache = new Map();
const SPRITE_SIZE = 32;

function getSprite(emoji) {
  let sprite = spriteCache.get(emoji);
  if (!sprite) {
    const off = document.createElement('canvas');
    off.width = SPRITE_SIZE;
    off.height = SPRITE_SIZE;
    const offCtx = off.getContext('2d');
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    offCtx.fillText(emoji, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
    sprite = off;
    spriteCache.set(emoji, off);
  }
  return sprite;
}

// Pre-compute category set for fast animal check
const ANIMAL_CATEGORIES = new Set(['herbivore', 'predator', 'undead', 'mythical', 'bug', 'bird', 'sea']);

export function addParticle(x, y, emoji) {
  // Hard cap particles to prevent explosion spam from killing perf at high entity counts
  if (particleArr.length > 500) return;
  particleArr.push({
    x, y,
    emoji,
    vx: (Math.random() - 0.5) * CONFIG.PARTICLE_SPEED * 2,
    vy: -Math.random() * CONFIG.PARTICLE_SPEED * 2 - 0.5,
    life: CONFIG.PARTICLE_LIFETIME,
    maxLife: CONFIG.PARTICLE_LIFETIME,
  });
}

export function getParticles() {
  return particleArr;
}

export function clearParticles() {
  particleArr.length = 0;
}

export function updateParticlesAndCleanup() {
  let writeIdx = 0;
  for (let i = 0; i < particleArr.length; i++) {
    const p = particleArr[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03; // gravity
    p.life--;
    if (p.life > 0) {
      particleArr[writeIdx++] = p;
    }
  }
  particleArr.length = writeIdx;
}

// ── Offscreen culling margin ──
const CULL_MARGIN = 40;

// Pre-allocated reused path objects for bar drawing (avoids GC)
const _barPathCache = {};

/** Determine render quality tier based on entity count */
function getPerfTier(len) {
  if (len > CONFIG.PERF_TIER_CRITICAL) return 'critical';
  if (len > CONFIG.PERF_TIER_HIGH) return 'high';
  return 'normal';
}

export function render(ctx, canvas, entities, paused) {
  const w = canvas._cssWidth || canvas.width;
  const h = canvas._cssHeight || canvas.height;
  const len = entities.length;

  // Background
  ctx.fillStyle = getCanvasBgColor();
  ctx.fillRect(0, 0, w, h);

  const tier = getPerfTier(len);

  // ── CRITICAL TIER (600+ entities): absolute minimal rendering ──
  if (tier === 'critical') {
    ctx.globalAlpha = 1;
    const cullMaxX = w + CULL_MARGIN;
    const cullMaxY = h + CULL_MARGIN;

    for (let i = 0; i < len; i++) {
      const entity = entities[i];
      if (entity.dead) continue;
      const ex = entity.x, ey = entity.y;
      if (ex < -CULL_MARGIN || ex > cullMaxX || ey < -CULL_MARGIN || ey > cullMaxY) continue;

      const sprite = getSprite(entity.emoji);
      ctx.drawImage(sprite, ex - SPRITE_SIZE / 2, ey - SPRITE_SIZE / 2);

      // Only hunger bar for animals, no other effects
      if (ANIMAL_CATEGORIES.has(entity.category) && entity.hunger !== undefined) {
        const barY = ey + 20;
        const barX = ex - 11;
        const hungerPct = entity.hunger / CONFIG.HUNGER_MAX;
        // Simplified single-color bar
        const r = Math.min(255, Math.round(510 * (1 - hungerPct)));
        const g = Math.min(255, Math.round(255 * hungerPct));
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(barX - 1, barY - 1, 24, 6);
        ctx.fillStyle = `rgb(${r},${g},0)`;
        ctx.fillRect(barX, barY, 22 * (1 - hungerPct), 4);
      }
    }

    // Skip particles entirely at critical tier
    particleArr.length = 0;
    ctx.globalAlpha = 1;
    return;
  }

  // ── HIGH TIER (300-600 entities): skip detailed visual effects ──
  // ── NORMAL TIER (<300 entities): full rendering with all effects ──

  const hungerMax = CONFIG.HUNGER_MAX;
  const cullMaxX = w + CULL_MARGIN;
  const cullMaxY = h + CULL_MARGIN;
  const isNormal = tier === 'normal';

  ctx.globalAlpha = 1;

  for (let i = 0; i < len; i++) {
    const entity = entities[i];
    if (entity.dead) continue;
    const ex = entity.x, ey = entity.y;

    if (ex < -CULL_MARGIN || ex > cullMaxX || ey < -CULL_MARGIN || ey > cullMaxY) continue;

    // ── Visual effects — only in normal tier ──
    if (isNormal) {
      if (entity._flashBomb) {
        ctx.fillStyle = 'rgba(255, 60, 30, 0.15)';
        ctx.beginPath();
        ctx.arc(ex, ey, 30, 0, Math.PI * 2);
        ctx.fill();
        entity._flashBomb = false;
      }

      if (entity._strikeFlash > 0 && entity._lastStrike) {
        const strike = entity._lastStrike;
        const flashAlpha = entity._strikeFlash * 0.05;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 200, ${flashAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(255, 255, 100, ${flashAlpha})`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(strike.x, strike.y - 100);
        let lx = strike.x, ly = strike.y - 100;
        for (let s = 0; s < 6; s++) {
          lx += (Math.random() - 0.5) * 60;
          ly += 100 / 6;
          ctx.lineTo(lx, ly);
        }
        ctx.lineTo(strike.x, strike.y + 30);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Status effects (cheap — only when active, which is rare)
    if (entity.frozen) {
      ctx.fillStyle = 'rgba(150, 220, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(ex, ey, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    if (entity.stunned) {
      const stunAlpha = 0.3 + Math.sin(entity.age * 0.5) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 0, ${stunAlpha})`;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', ex, ey - 26);
    }

    if (entity.webbed) {
      ctx.fillStyle = 'rgba(200, 200, 220, 0.25)';
      ctx.beginPath();
      ctx.arc(ex, ey, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    if (entity.infected) {
      const infectFlash = Math.sin(entity.age * 0.3) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(120, 200, 80, ${infectFlash * 0.2})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    if (entity.poisoned) {
      ctx.fillStyle = 'rgba(160, 0, 200, 0.2)';
      ctx.beginPath();
      ctx.arc(ex, ey, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Render emoji (pre-rendered sprite for performance) ──
    const hasHunger = entity.hunger !== undefined;
    const sprite = getSprite(entity.emoji);
    const sx = ex - SPRITE_SIZE / 2;
    const sy = ey - SPRITE_SIZE / 2;

    if (hasHunger) {
      const alpha = 1 - (entity.hunger / hungerMax) * 0.5;
      if (alpha < 0.98) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, sx, sy);
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(sprite, sx, sy);
      }
    } else {
      ctx.drawImage(sprite, sx, sy);
    }

    // ── Bars (only in normal tier; high tier skips HP bars) ──
    if (ANIMAL_CATEGORIES.has(entity.category) && hasHunger) {
      const barWidth = 22;
      const barHeight = 4;
      const barY = ey + 20;
      const barX = ex - barWidth / 2;
      const hungerPct = entity.hunger / hungerMax;

      let barColor;
      if (hungerPct < 0.4) {
        const t = hungerPct / 0.4;
        barColor = `rgb(${Math.round(255 * t)}, 220, ${Math.round(80 * (1 - t))})`;
      } else if (hungerPct < 0.7) {
        const t = (hungerPct - 0.4) / 0.3;
        barColor = `rgb(255, ${Math.round(220 - 100 * t)}, ${Math.round(80 * (1 - t))})`;
      } else {
        barColor = `rgb(255, ${Math.round(120 * (1 - (hungerPct - 0.7) / 0.3))}, 0)`;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barWidth * (1 - hungerPct), barHeight);

      if (entity.state === 'full') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(ex, ey - 22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HP bar — only in normal tier
    if (isNormal && entity.hp > 3) {
      const hpBarWidth = 24;
      const hpBarHeight = 3;
      const hpY = ey + 26;
      const hpX = ex - hpBarWidth / 2;
      const hpRatio = entity.hp / (entity._maxHp || entity.hp);

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
      ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(hpX, hpY, hpBarWidth * hpRatio, hpBarHeight);
    }

    if (entity.blinded) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(ex, ey, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Particles (skip at high tier) ──
  ctx.globalAlpha = 1;
  if (!paused) updateParticlesAndCleanup();
  if (isNormal) {
    for (let i = 0; i < particleArr.length; i++) {
      const p = particleArr[i];
      const ratio = p.life / p.maxLife;
      ctx.globalAlpha = ratio;
      ctx.font = `${16 + ratio * 8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText(p.emoji, p.x, p.y);
    }
  } else {
    // High tier: clear particles, don't render them
    particleArr.length = 0;
  }
  ctx.globalAlpha = 1;
}
