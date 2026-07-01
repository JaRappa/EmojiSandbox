// render.js — Canvas rendering: entities, particles, grid overlay.
import CONFIG from './config.js';

let particleArr = [];

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

  // Optional faint grid
  // ctx.strokeStyle = CONFIG.GRID_COLOR;
  // ctx.lineWidth = 0.5;
  // for (let x = 0; x < w; x += CONFIG.GRID_CELL_SIZE) {
  //   ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  // }
  // for (let y = 0; y < h; y += CONFIG.GRID_CELL_SIZE) {
  //   ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  // }

  // Entities
  for (const entity of entities) {
    if (entity.dead) continue;
    const hasHunger = entity.hunger !== undefined;
    const alpha = hasHunger
      ? 1 - (entity.hunger / CONFIG.HUNGER_MAX) * 0.5
      : 1;
    ctx.globalAlpha = alpha;
    ctx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y);

    // Hunger bar below animals (skip static entities like plants, fire, water)
    const isAnimal = entity.category === 'herbivore' || entity.category === 'predator';
    if (isAnimal && entity.hunger !== undefined) {
      const barWidth = 22;
      const barHeight = 4;
      const barY = entity.y + 20;
      const barX = entity.x - barWidth / 2;
      const hungerPct = entity.hunger / CONFIG.HUNGER_MAX; // 0 = full, 1 = starving

      // Color: green → yellow → red
      let barColor;
      if (hungerPct < 0.4) {
        // green to yellow
        const t = hungerPct / 0.4;
        barColor = `rgb(${Math.round(255 * t)}, 220, ${Math.round(80 * (1 - t))})`;
      } else if (hungerPct < 0.7) {
        // yellow to orange
        const t = (hungerPct - 0.4) / 0.3;
        barColor = `rgb(255, ${Math.round(220 - 100 * t)}, ${Math.round(80 * (1 - t))})`;
      } else {
        // orange to red
        const t = (hungerPct - 0.7) / 0.3;
        barColor = `rgb(255, ${Math.round(120 - 80 * t)}, ${Math.round(30 * (1 - t))})`;
      }

      // Background (semi-transparent dark)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

      // Filled portion (full = wider bar)
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barWidth * (1 - hungerPct), barHeight);
    }

    // Small green dot above full animals to show they won't eat
    if (entity.state === 'full') {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y - 22, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  // Sweep cone visualization (disabled)
  // Uncomment the block below to re-enable the sweep cone overlay
  /*
  for (const entity of entities) {
    if (entity.dead || entity._sweepInterest === undefined) continue;
    const interest = entity._sweepInterest;
    if (interest < 0.05) continue;
    const coneAlpha = interest * 0.06;
    const sweepRange = CONFIG.SWEEP_RANGE * interest;
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity._sweepAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, sweepRange, -CONFIG.SWEEP_ARC, CONFIG.SWEEP_ARC);
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sweepRange);
    grad.addColorStop(0, `rgba(255, 220, 100, ${coneAlpha * 3})`);
    grad.addColorStop(0.5, `rgba(255, 200, 60, ${coneAlpha * 1.5})`);
    grad.addColorStop(1, `rgba(255, 180, 30, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 220, 100, ${coneAlpha * 2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sweepRange, 0);
    ctx.stroke();
    ctx.restore();
  }
  */

  // Particles
  if (!paused) updateParticles();
  for (const p of particleArr) {
    const ratio = p.life / p.maxLife;
    ctx.globalAlpha = ratio;
    ctx.font = `${16 + ratio * 8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
