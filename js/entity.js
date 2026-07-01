// entity.js — Entity factory and per-tick update logic.
import CONFIG from './config.js';
import { SPECIES, EATS, FLEES } from './rules.js';
import { wander, seek, arrive, flee, edgeBounce, sweepScan } from './behaviors.js';

let _nextId = 1;

export function createEntity(type, x, y) {
  const species = SPECIES[type];
  if (!species) return null;
  _nextId++;
  return {
    id: type + '_' + _nextId,
    type,
    emoji: species.emoji,
    category: species.category,
    x, y,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    hunger: CONFIG.HUNGER_SEEK_THRESHOLD,  // spawn hungry — ready to find food
    state: 'wander',
    targetId: null,
    age: 0,
    hp: 3,
    dead: false,
    spawnTimer: 0,
    lifespan: species.lifespanTicks ?? -1,
    _wanderAngle: Math.random() * Math.PI * 2,
    _sweepAngle: Math.random() * Math.PI * 2,   // rotating cone scan direction
    _sweepInterest: 0,                           // 0-1 interest level from sweep (decays over time)
    _sweepTargetType: null,                      // category last detected via sweep
    _fullCooldown: 0,                            // ticks before animal can eat again after feeding
    reproductionCooldown: 0,
  };
}

export function updateEntity(entity, grid, canvasWidth, canvasHeight, entities, delta) {
  if (entity.dead) return;
  entity.age++;
  if (entity.reproductionCooldown > 0) entity.reproductionCooldown--;
  if (entity._fullCooldown > 0) entity._fullCooldown--;

  const species = SPECIES[entity.type];
  if (!species || species.static) {
    // Static entities — plants spawn, fire/water have lifespan
    if (species.category === 'plant') updatePlant(entity, grid, entities);
    if (species.category === 'fire') updateFire(entity, grid, entities);
    if (species.category === 'water') updateWater(entity, grid, entities);
    if (entity.lifespan > 0) {
      entity.lifespan--;
      if (entity.lifespan <= 0) entity.dead = true;
    }
    return;
  }

  // ── Animals ────────────────────────────
  const speciesHungerRate = species.hungerRate ?? CONFIG.HUNGER_RATE;
  entity.hunger += speciesHungerRate;
  if (entity.hunger >= CONFIG.HUNGER_MAX) {
    entity.dead = true;
    return;
  }

  const speed = species.speed * CONFIG.MAX_SPEED_MULTIPLIER;
  let ax = 0, ay = 0;
  entity.state = 'wander';

  // Priority 1: Flee
  const fears = FLEES[entity.category];
  if (fears) {
    const threats = grid.query(entity.x, entity.y, species.senseRadius);
    for (const { entity: other } of threats) {
      if (other === entity || other.dead) continue;
      if (fears.includes(other.category)) {
        const [fx, fy] = flee(entity, other);
        ax += fx;
        ay += fy;
        entity.state = 'flee';
        break; // first threat is enough
      }
    }
  }

  // Priority 2: Seek food — only when hungry enough AND not full from a recent meal
  const isHungry = entity.hunger >= CONFIG.HUNGER_SEEK_THRESHOLD;
  const canEat = entity._fullCooldown <= 0;
  const shouldSeek = isHungry && canEat;

  if (entity.state !== 'flee' && shouldSeek) {
    const edible = EATS[entity.category];
    if (edible) {
      const nearby = grid.query(entity.x, entity.y, species.senseRadius);
      // Sort by distance
      nearby.sort((a, b) => a.distSq - b.distSq);
      for (const { entity: other, dist } of nearby) {
        if (other === entity || other.dead) continue;
        if (edible.includes(other.category)) {
          if (dist < CONFIG.EAT_DISTANCE) {
            // Eat it!
            other.dead = true;
            entity.hunger = CONFIG.HUNGER_EAT_ZERO;
            entity._fullCooldown = CONFIG.HUNGER_FULL_COOLDOWN;
            entity.state = 'eat';
            entity.targetId = null;
            // Spawn a particle signal
            entity._ateAt = { x: other.x, y: other.y };
          } else {
            const steeringFn = (entity.category === 'predator') ? seek : (dist < 80 ? arrive : seek);
            const [sx, sy] = steeringFn(entity, other);
            ax += sx;
            ay += sy;
            entity.state = 'seek';
            entity.targetId = other.id;
          }
          break;
        }
      }
    }
  }

  // Priority 3: Sweep scan — long-range rotating cone, when wandering (or full)
  if (entity.state === 'wander' || entity.state === 'full') {
    const edible = EATS[entity.category];
    const fears = FLEES[entity.category];
    const sweep = sweepScan(entity, grid, species, edible, fears);

    if (sweep.steering) {
      // Gentle pull from sweep toward far-away target
      ax += sweep.steering[0];
      ay += sweep.steering[1];
      // If interest is high enough, transition to a directional wander-like stance
      if (sweep.interest > 0.4) {
        entity.state = 'sweeping';
      }
    }
  }

  // Priority 4: Wander (or full)
  if (entity.state === 'wander' || entity.state === 'sweeping') {
    // If not hungry but not seeking, animal is "full"
    if (!isHungry && entity._fullCooldown > 0) {
      entity.state = 'full';
    }
    const [wx, wy] = wander(entity, species);
    // When sweeping with interest, bias the wander angle toward the sweep direction
    if (entity.state === 'sweeping' && entity._sweepInterest > 0.3) {
      const sweepInfluence = entity._sweepInterest * 0.6;
      const sx = Math.cos(entity._sweepAngle) * CONFIG.WANDER_STRENGTH * sweepInfluence;
      const sy = Math.sin(entity._sweepAngle) * CONFIG.WANDER_STRENGTH * sweepInfluence;
      ax += wx * (1 - sweepInfluence) + sx;
      ay += wy * (1 - sweepInfluence) + sy;
    } else {
      ax += wx;
      ay += wy;
    }
  }

  // Edge bounce
  const [bx, by] = edgeBounce(entity, canvasWidth, canvasHeight);
  ax += bx;
  ay += by;

  // Apply acceleration
  entity.vx += ax;
  entity.vy += ay;

  // Clamp speed
  const vLen = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
  if (vLen > speed) {
    entity.vx = (entity.vx / vLen) * speed;
    entity.vy = (entity.vy / vLen) * speed;
  }

  // Move
  entity.x += entity.vx;
  entity.y += entity.vy;

  // No spawning outside canvas
  entity.x = Math.max(0, Math.min(canvasWidth, entity.x));
  entity.y = Math.max(0, Math.min(canvasHeight, entity.y));
}

/** Plant: spawn fruit on interval */
function updatePlant(entity, grid, entities) {
  const species = SPECIES[entity.type];
  if (!species.spawns) return;
  entity.spawnTimer = (entity.spawnTimer || 0) + 1;
  if (entity.spawnTimer >= species.spawnEveryTicks) {
    entity.spawnTimer = 0;
    // Count nearby fruit
    const nearby = grid.query(entity.x, entity.y, CONFIG.PLANT_SPAWN_RADIUS);
    let fruitCount = 0;
    for (const { entity: e } of nearby) {
      if (e.category === 'food') fruitCount++;
    }
    if (fruitCount < CONFIG.PLANT_MAX_FRUIT_NEARBY) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * CONFIG.PLANT_SPAWN_RADIUS;
      const fx = entity.x + Math.cos(angle) * dist;
      const fy = entity.y + Math.sin(angle) * dist;
      const fruit = createEntity(species.spawns, fx, fy);
      entities.push(fruit);
    }
  }
}

/** Fire: spreads to plants in radius */
function updateFire(entity, grid, entities) {
  const species = SPECIES[entity.type];
  if (!species.spreadsTo) return;
  const targets = grid.query(entity.x, entity.y, CONFIG.FIRE_SPREAD_RADIUS);
  for (const { entity: other } of targets) {
    if (other.dead) continue;
    if (other.category === species.spreadsTo) {
      // Convert plant to fire
      const fire = createEntity('fire', other.x, other.y);
      entities.push(fire);
      other.dead = true;
    }
  }
}

function updateWater(entity, grid, entities) {
  const species = SPECIES[entity.type];
  if (!species.extinguishes) return;
  const targets = grid.query(entity.x, entity.y, CONFIG.WATER_RADIUS);
  for (const { entity: other } of targets) {
    if (other.dead) continue;
    if (other.category === species.extinguishes) {
      other.dead = true;
    }
  }
}
