// render.js — Canvas rendering: entities, particles, grid overlay.
import CONFIG from './config.js';

let particleArr = [];

// Pre-compute category set for fast animal check
const ANIMAL_CATEGORIES = new Set(['herbivore', 'predator', 'undead', 'mythical', 'bug', 'bird', 'sea']);

export function addParticle(x, y, emoji) {
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

function updateParticles() {
  for (let i = particleArr.length - 1; i >= 0; i--) {
    const p = particleArr[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03; // gravity
    p.life--;
    if (p.life <= 0) particleArr.splice(i, 1);
  }
}

export function render(ctx, canvas, entities, paused) {
  const w = canvas._cssWidth || canvas.width;
  const h = canvas._cssHeight || canvas.height;

  // Background
  ctx.fillStyle = CONFIG.BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // ── Pre-set font for emoji rendering (avoid string concat in loop) ──
  const emojiFont = CONFIG.EMOJI_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ── Cache CONFIG lookups ──
  const hungerMax = CONFIG.HUNGER_MAX;

  // ── Render entities ──
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (entity.dead) continue;
    const ex = entity.x, ey = entity.y;

    // ── Visual effects ──
    // Bomb flash effect
    if (entity._flashBomb) {
      ctx.fillStyle = 'rgba(255, 60, 30, 0.15)';
      ctx.beginPath();
      ctx.arc(ex, ey, 30, 0, Math.PI * 2);
      ctx.fill();
      entity._flashBomb = false;
    }

    // Lightning strike flash
    if (entity._strikeFlash > 0 && entity._lastStrike) {
      const flashAlpha = entity._strikeFlash * 0.05;
      const strike = entity._lastStrike;

      // Draw lightning bolt
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 200, ${flashAlpha})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgba(255, 255, 100, ${flashAlpha})`;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(strike.x, strike.y - 100);
      let lx = strike.x;
      let ly = strike.y - 100;
      const segments = 6;
      for (let s = 0; s < segments; s++) {
        lx += (Math.random() - 0.5) * 60;
        ly += 100 / segments;
        ctx.lineTo(lx, ly);
      }
      ctx.lineTo(strike.x, strike.y + 30);
      ctx.stroke();
      ctx.restore();

      // Flash circle
      ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(strike.x, strike.y, CONFIG.LIGHTNING_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frozen glow
    if (entity.frozen) {
      ctx.fillStyle = 'rgba(150, 220, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(ex, ey, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Stunned indicator
    if (entity.stunned) {
      const stunAlpha = 0.3 + Math.sin(entity.age * 0.5) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 0, ${stunAlpha})`;
      ctx.font = '14px sans-serif';
      ctx.fillText('⚡', ex, ey - 26);
    }

    // Webbed indicator
    if (entity.webbed) {
      ctx.fillStyle = 'rgba(200, 200, 220, 0.25)';
      ctx.beginPath();
      ctx.arc(ex, ey, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 220, 240, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Infected visual
    if (entity.infected) {
      const infectFlash = Math.sin(entity.age * 0.3) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(120, 200, 80, ${infectFlash * 0.2})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Poisoned visual
    if (entity.poisoned) {
      ctx.fillStyle = 'rgba(160, 0, 200, 0.2)';
      ctx.beginPath();
      ctx.arc(ex, ey, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Render emoji ──
    const hasHunger = entity.hunger !== undefined;
    const alpha = hasHunger
      ? 1 - (entity.hunger / hungerMax) * 0.5
      : 1;
    ctx.globalAlpha = alpha;
    ctx.font = emojiFont;
    ctx.fillText(entity.emoji, ex, ey);

    // ── Bars (hunger, HP, state indicators) ──
    if (ANIMAL_CATEGORIES.has(entity.category) && hasHunger) {
      const barWidth = 22;
      const barHeight = 4;
      const barY = ey + 20;
      const barX = ex - barWidth / 2;
      const hungerPct = entity.hunger / hungerMax;

      // Color: green → yellow → red
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

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

      // Filled portion
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barWidth * (1 - hungerPct), barHeight);

      // Small green dot above full animals
      if (entity.state === 'full') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(ex, ey - 22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HP bar for entities with > 3 HP
    if (entity.hp > 3) {
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

    // Blind / ink indicator
    if (entity.blinded) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(ex, ey, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Particles ──
  ctx.globalAlpha = 1;
  if (!paused) updateParticles();
  for (let i = 0; i < particleArr.length; i++) {
    const p = particleArr[i];
    const ratio = p.life / p.maxLife;
    ctx.globalAlpha = ratio;
    ctx.font = `${16 + ratio * 8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(p.emoji, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
