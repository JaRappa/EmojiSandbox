// render.js — Canvas rendering: entities, particles, grid overlay.
import CONFIG from './config.js';
import { SPECIES } from './rules.js';

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

    // Bomb flash effect
    if (entity._flashBomb) {
      ctx.fillStyle = 'rgba(255, 60, 30, 0.15)';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 30, 0, Math.PI * 2);
      ctx.fill();
      entity._flashBomb = false;
    }

    // Lightning strike flash
    if (entity._strikeFlash > 0 && entity._lastStrike) {
      const flashAlpha = entity._strikeFlash / 10 * 0.5;
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
      ctx.save();
      ctx.fillStyle = 'rgba(150, 220, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Stunned indicator
    if (entity.stunned) {
      ctx.save();
      const stunAlpha = 0.3 + Math.sin(entity.age * 0.5) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 0, ${stunAlpha})`;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', entity.x, entity.y - 26);
      ctx.restore();
    }

    // Webbed indicator
    if (entity.webbed) {
      ctx.save();
      ctx.fillStyle = 'rgba(200, 200, 220, 0.25)';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 220, 240, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Infected visual
    if (entity.infected) {
      const infectFlash = Math.sin(entity.age * 0.3) * 0.5 + 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(120, 200, 80, ${infectFlash * 0.2})`;
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Poisoned visual
    if (entity.poisoned) {
      ctx.save();
      ctx.fillStyle = `rgba(160, 0, 200, 0.2)`;
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const hasHunger = entity.hunger !== undefined;
    const alpha = hasHunger
      ? 1 - (entity.hunger / CONFIG.HUNGER_MAX) * 0.5
      : 1;
    ctx.globalAlpha = alpha;
    ctx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y);

    // Hunger bar below animals
    const isAnimal = entity.category === 'herbivore' || entity.category === 'predator' || entity.category === 'undead' || entity.category === 'mythical' || entity.category === 'bug' || entity.category === 'bird' || entity.category === 'sea';
    if (isAnimal && entity.hunger !== undefined) {
      const barWidth = 22;
      const barHeight = 4;
      const barY = entity.y + 20;
      const barX = entity.x - barWidth / 2;
      const hungerPct = entity.hunger / CONFIG.HUNGER_MAX; // 0 = full, 1 = starving

      // Color: green → yellow → red
      let barColor;
      if (hungerPct < 0.4) {
        const t = hungerPct / 0.4;
        barColor = `rgb(${Math.round(255 * t)}, 220, ${Math.round(80 * (1 - t))})`;
      } else if (hungerPct < 0.7) {
        const t = (hungerPct - 0.4) / 0.3;
        barColor = `rgb(255, ${Math.round(220 - 100 * t)}, ${Math.round(80 * (1 - t))})`;
      } else {
        const t = (hungerPct - 0.7) / 0.3;
        barColor = `rgb(255, ${Math.round(120 - 80 * t)}, ${Math.round(30 * (1 - t))})`;
      }

      // Background (semi-transparent dark)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

      // Filled portion
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barWidth * (1 - hungerPct), barHeight);
    }

    // HP bar for entities with > 3 HP
    if (entity.hp > 3) {
      const hpBarWidth = 24;
      const hpBarHeight = 3;
      const hpY = entity.y + 26;
      const hpX = entity.x - hpBarWidth / 2;
      const hpRatio = entity.hp / (SPECIES[entity.type]?.hp || entity.hp);

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
      ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(hpX, hpY, hpBarWidth * hpRatio, hpBarHeight);
    }

    // Small green dot above full animals
    if (entity.state === 'full') {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y - 22, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blind / ink indicator
    if (entity.blinded) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, 20, 0, Math.PI * 2);
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
