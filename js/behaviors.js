// behaviors.js — Steering behaviors: wander, seek, flee.
import CONFIG from './config.js';

/** Add a small random steering force; return [ax, ay]. */
export function wander(entity, species) {
  if (!entity._wanderAngle) entity._wanderAngle = Math.random() * Math.PI * 2;
  const changeRate = entity._wanderChangeRate || CONFIG.WANDER_DIRECTION_CHANGE;
  entity._wanderAngle += (Math.random() - 0.5) * changeRate;
  // Wrap angle
  entity._wanderAngle = ((entity._wanderAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return [
    Math.cos(entity._wanderAngle) * CONFIG.WANDER_STRENGTH,
    Math.sin(entity._wanderAngle) * CONFIG.WANDER_STRENGTH,
  ];
}

/** Steer toward target at seek strength (uses per-entity variance if available). */
export function seek(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return [0, 0];
  const str = entity._seekStrength || CONFIG.SEEK_STRENGTH;
  return [(dx / len) * str, (dy / len) * str];
}

/** Steer toward target with arrival deceleration — slows near target so we can eat it. */
export function arrive(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.01) return [0, 0];

  const seekStr = entity._seekStrength || CONFIG.SEEK_STRENGTH;
  const desiredSpeed = Math.min(seekStr * 60, dist * 0.06);
  const desired = [(dx / dist) * desiredSpeed, (dy / dist) * desiredSpeed];
  const steer = [
    desired[0] - entity.vx,
    desired[1] - entity.vy,
  ];
  // Clamp steering force
  const steerLen = Math.sqrt(steer[0] * steer[0] + steer[1] * steer[1]);
  const maxForce = seekStr;
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
  const fleeStr = entity._fleeStrength || CONFIG.FLEE_STRENGTH;
  if (len < 0.01) return [(Math.random() - 0.5) * fleeStr, (Math.random() - 0.5) * fleeStr];

  // Add a random scatter to the flee direction so not everyone runs the same way
  const scatterAngle = (Math.random() - 0.5) * 0.6; // ±~17° jitter
  const cosS = Math.cos(scatterAngle), sinS = Math.sin(scatterAngle);
  const baseX = dx / len, baseY = dy / len;
  const dirX = baseX * cosS - baseY * sinS;
  const dirY = baseX * sinS + baseY * cosS;

  const fx = dirX * fleeStr;
  const fy = dirY * fleeStr;

  // Perpendicular jitter for evasion — makes prey harder to catch
  const perpX = -dirY;
  const perpY = dirX;
  const jitterStrength = fleeStr * 0.4;
  if (!entity._fleeSide) entity._fleeSide = Math.random() < 0.5 ? -1 : 1;
  entity._fleeSide *= (Math.random() < 0.03 ? -1 : 1);

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
  // Rotate the sweep angle — use per-entity speed if set
  const sweepSpeed = entity._sweepSpeed || CONFIG.SWEEP_SPEED;
  entity._sweepAngle = ((entity._sweepAngle + sweepSpeed) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

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
    const seekStr = entity._seekStrength || CONFIG.SEEK_STRENGTH;
    const pullStrength = seekStr * 0.25 * entity._sweepInterest;
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

/**
 * Predictive wall avoidance — looks ahead and redirects velocity BEFORE hitting a wall.
 * Only activates when the entity is actually heading toward an edge.
 * No repulsion when moving parallel to or away from walls.
 */
export function edgeBounce(entity, canvasWidth, canvasHeight) {
  const margin = CONFIG.EDGE_BOUNCE_MARGIN;
  const lookAhead = 20;                         // ticks to project ahead
  const turnStrength = CONFIG.EDGE_BOUNCE_STRENGTH || 3.0;

  let ax = 0, ay = 0;

  // Predict where we'll be if we keep moving in current direction
  const futureX = entity.x + entity.vx * lookAhead;
  const futureY = entity.y + entity.vy * lookAhead;

  // Only redirect if heading TOWARD the wall (checks velocity sign)
  if (entity.vx < 0 && futureX < margin) {
    // heading left into wall — steer right
    const urgency = 1 - Math.max(0, futureX) / margin;
    ax += turnStrength * urgency * urgency;
  }
  if (entity.vx > 0 && futureX > canvasWidth - margin) {
    // heading right into wall — steer left
    const urgency = 1 - Math.max(0, canvasWidth - futureX) / margin;
    ax -= turnStrength * urgency * urgency;
  }
  if (entity.vy < 0 && futureY < margin) {
    // heading up into wall — steer down
    const urgency = 1 - Math.max(0, futureY) / margin;
    ay += turnStrength * urgency * urgency;
  }
  if (entity.vy > 0 && futureY > canvasHeight - margin) {
    // heading down into wall — steer up
    const urgency = 1 - Math.max(0, canvasHeight - futureY) / margin;
    ay -= turnStrength * urgency * urgency;
  }

  return [ax, ay];
}

/**
 * Flocking: separation, alignment, cohesion for group-moving species.
 * Returns [ax, ay] force to add.
 */
export function flocking(entity, grid, species) {
  const nearby = grid.query(entity.x, entity.y, CONFIG.FLOCK_RADIUS);
  const neighbors = [];

  for (const { entity: other } of nearby) {
    if (other === entity || other.dead) continue;
    if (other.type === entity.type) {
      neighbors.push(other);
    }
  }

  if (neighbors.length === 0) return [0, 0];

  let sepX = 0, sepY = 0;
  let avgVx = 0, avgVy = 0;
  let centerX = 0, centerY = 0;
  let sepCount = 0;

  for (const n of neighbors) {
    const dx = entity.x - n.x;
    const dy = entity.y - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CONFIG.FLOCK_SEPARATION && dist > 0.01) {
      sepX += (dx / dist) / dist;
      sepY += (dy / dist) / dist;
      sepCount++;
    }
    avgVx += n.vx;
    avgVy += n.vy;
    centerX += n.x;
    centerY += n.y;
  }

  let ax = 0, ay = 0;
  const n = neighbors.length;

  // Separation
  if (sepCount > 0) {
    ax += (sepX / sepCount) * CONFIG.FLOCK_SEPARATION_FORCE;
    ay += (sepY / sepCount) * CONFIG.FLOCK_SEPARATION_FORCE;
  }

  // Alignment
  avgVx /= n;
  avgVy /= n;
  ax += (avgVx - entity.vx) * CONFIG.FLOCK_ALIGNMENT;
  ay += (avgVy - entity.vy) * CONFIG.FLOCK_ALIGNMENT;

  // Cohesion
  centerX /= n;
  centerY /= n;
  const cohDx = centerX - entity.x;
  const cohDy = centerY - entity.y;
  ax += cohDx * CONFIG.FLOCK_COHESION;
  ay += cohDy * CONFIG.FLOCK_COHESION;

  return [ax, ay];
}
