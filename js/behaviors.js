// behaviors.js — Steering behaviors: wander, seek, flee.
import CONFIG from './config.js';

/** Add a small random steering force; return [ax, ay]. */
export function wander(entity, species) {
  if (!entity._wanderAngle) entity._wanderAngle = Math.random() * Math.PI * 2;
  entity._wanderAngle += (Math.random() - 0.5) * CONFIG.WANDER_DIRECTION_CHANGE;
  // Wrap angle
  entity._wanderAngle = ((entity._wanderAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return [
    Math.cos(entity._wanderAngle) * CONFIG.WANDER_STRENGTH,
    Math.sin(entity._wanderAngle) * CONFIG.WANDER_STRENGTH,
  ];
}

/** Steer toward target at seek strength. */
export function seek(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return [0, 0];
  return [(dx / len) * CONFIG.SEEK_STRENGTH, (dy / len) * CONFIG.SEEK_STRENGTH];
}

/** Steer toward target with arrival deceleration — slows near target so we can eat it. */
export function arrive(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.01) return [0, 0];

  const desiredSpeed = Math.min(CONFIG.SEEK_STRENGTH * 60, dist * 0.06);
  const desired = [(dx / dist) * desiredSpeed, (dy / dist) * desiredSpeed];
  const steer = [
    desired[0] - entity.vx,
    desired[1] - entity.vy,
  ];
  // Clamp steering force
  const steerLen = Math.sqrt(steer[0] * steer[0] + steer[1] * steer[1]);
  const maxForce = CONFIG.SEEK_STRENGTH;
  if (steerLen > maxForce) {
    steer[0] = (steer[0] / steerLen) * maxForce;
    steer[1] = (steer[1] / steerLen) * maxForce;
  }
  return steer;
}

/** Steer away from threat at flee strength with a perpendicular jitter for evasion. */
export function flee(entity, threat) {
  const dx = entity.x - threat.x;
  const dy = entity.y - threat.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4];

  // Primary flee: directly away
  const fx = (dx / len) * CONFIG.FLEE_STRENGTH;
  const fy = (dy / len) * CONFIG.FLEE_STRENGTH;

  // Perpendicular jitter for evasion — makes prey harder to catch
  const perpX = -dy / len;
  const perpY = dx / len;
  const jitterStrength = CONFIG.FLEE_STRENGTH * 0.4;
  // Use a per-entity side preference that occasionally switches
  if (!entity._fleeSide) entity._fleeSide = Math.random() < 0.5 ? -1 : 1;
  entity._fleeSide *= (Math.random() < 0.03 ? -1 : 1); // occasionally switch

  return [
    fx + perpX * jitterStrength * entity._fleeSide,
    fy + perpY * jitterStrength * entity._fleeSide,
  ];
}

/**
 * Sweep scan — a slow, rotating long-range cone that detects relevant entities.
 * Returns { steering, interest } where:
 *   steering: [ax, ay] gentle pull toward detected target (null if nothing found)
 *   interest: 0-1 how strongly interested in the swept direction
 */
export function sweepScan(entity, grid, species, edible, fears) {
  // Rotate the sweep angle
  entity._sweepAngle = ((entity._sweepAngle + CONFIG.SWEEP_SPEED) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

  // Query a wide area — use the spatial grid with the sweep range
  const nearby = grid.query(entity.x, entity.y, CONFIG.SWEEP_RANGE);

  let bestTarget = null;
  let bestCategory = null;
  let bestDistSq = Infinity;
  let bestAngle = 0;

  for (const { entity: other, dist, distSq } of nearby) {
    if (other === entity || other.dead) continue;

    // Check if it's something we care about (food or threat)
    const isFood = edible && edible.includes(other.category);
    const isThreat = fears && fears.includes(other.category);
    if (!isFood && !isThreat) continue;

    // Is it within our sweep cone?
    const dx = other.x - entity.x;
    const dy = other.y - entity.y;
    const angleToOther = Math.atan2(dy, dx);

    // Angular difference (handling wrap)
    let angleDiff = angleToOther - entity._sweepAngle;
    angleDiff = ((angleDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

    if (Math.abs(angleDiff) < CONFIG.SWEEP_ARC) {
      // Closer to the center of the cone = stronger signal
      const coneCloseness = 1 - Math.abs(angleDiff) / CONFIG.SWEEP_ARC;
      // Closer in distance = stronger signal (prioritize nearby things)
      const distScore = 1 - Math.min(dist / CONFIG.SWEEP_RANGE, 1);
      const score = coneCloseness * 0.3 + distScore * 0.7;

      if (score > 0 && distSq < bestDistSq) {
        bestTarget = other;
        bestCategory = other.category;
        bestDistSq = distSq;
        bestAngle = angleToOther;
      }
    }
  }

  // Decay existing interest
  entity._sweepInterest = Math.max(0, entity._sweepInterest - CONFIG.SWEEP_INTEREST_DECAY);

  if (bestTarget) {
    // Boost interest — rapid rise, slow decay
    entity._sweepInterest = Math.min(1, entity._sweepInterest + 0.15);
    entity._sweepTargetType = bestCategory;

    // Gentle pull toward the detected target (much weaker than seek)
    const pullStrength = CONFIG.SEEK_STRENGTH * 0.25 * entity._sweepInterest;
    const dx = bestTarget.x - entity.x;
    const dy = bestTarget.y - entity.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.01) {
      return {
        steering: [(dx / len) * pullStrength, (dy / len) * pullStrength],
        interest: entity._sweepInterest,
        foundTarget: true,
      };
    }
  }

  // No target found — but if interest is still high, bias wander slightly
  // in the last known direction (handled in entity.js)
  entity._sweepTargetType = null;
  return { steering: null, interest: entity._sweepInterest, foundTarget: false };
}

/** Soft-bounce off canvas edges. */
export function edgeBounce(entity, canvasWidth, canvasHeight) {
  const m = CONFIG.EDGE_BOUNCE_MARGIN;
  let ax = 0, ay = 0;
  const strength = 0.5;
  if (entity.x < m) ax += strength * (1 - entity.x / m);
  if (entity.x > canvasWidth - m) ax -= strength * (1 - (canvasWidth - entity.x) / m);
  if (entity.y < m) ay += strength * (1 - entity.y / m);
  if (entity.y > canvasHeight - m) ay -= strength * (1 - (canvasHeight - entity.y) / m);
  return [ax, ay];
}
