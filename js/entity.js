// entity.js — Entity factory and per-tick update logic.
import CONFIG from './config.js';
import { SPECIES, EATS, FLEES } from './rules.js';
import { wander, seek, arrive, flee, sweepScan, flockingFromNearby } from './behaviors.js';

let _nextId = 1;

export function createEntity(type, x, y) {
  const species = SPECIES[type];
  if (!species) return null;
  _nextId++;
  // ── Per-entity random variation so animals don't all act identically ──
  const seed = Math.random(); // unique per-entity seed
  const hungerSpread = (seed - 0.5) * 40;        // ±20 spread around seek threshold
  const wanderSpeedVariance = 0.6 + seed * 0.8;   // 0.6x – 1.4x direction change rate
  const seekVariance = 0.7 + seed * 0.6;         // 0.7x – 1.3x seek strength
  const fleeVariance = 0.7 + seed * 0.6;         // 0.7x – 1.3x flee strength
  const senseVariance = 0.8 + seed * 0.4;         // 0.8x – 1.2x sense radius
  const speedVariance = 0.8 + seed * 0.4;         // 0.8x – 1.2x speed multiplier
  const sweepSpeedVariance = 0.5 + seed * 1.0;    // 0.5x – 1.5x sweep rotation speed

  return {
    id: type + '_' + _nextId,
    type,
    emoji: species.emoji,
    category: species.category,
    x, y,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    hunger: CONFIG.HUNGER_SEEK_THRESHOLD + hungerSpread,  // varies so not all seek at once
    state: 'wander',
    targetId: null,
    age: 0,
    hp: (species.hp || 3) + Math.floor((seed - 0.5) * 3),  // ±1 hp variation
    _maxHp: species.hp || 3,  // cached for fast render HP bar
    dead: false,
    spawnTimer: 0,
    lifespan: species.lifespanTicks ? species.lifespanTicks + Math.floor((seed - 0.5) * 120) : -1,
    _wanderAngle: Math.random() * Math.PI * 2,
    _wanderChangeRate: CONFIG.WANDER_DIRECTION_CHANGE * wanderSpeedVariance,
    _seekStrength: CONFIG.SEEK_STRENGTH * seekVariance,
    _fleeStrength: CONFIG.FLEE_STRENGTH * fleeVariance,
    _senseRadiusMultiplier: senseVariance,
    _speedMultiplier: speedVariance,
    _sweepSpeed: CONFIG.SWEEP_SPEED * sweepSpeedVariance,
    _sweepAngle: Math.random() * Math.PI * 2,   // rotating cone scan direction
    _sweepInterest: 0,                           // 0-1 interest level from sweep (decays over time)
    _sweepTargetType: null,                      // category last detected via sweep
    _fullCooldown: 0,                            // ticks before animal can eat again after feeding
    reproductionCooldown: 0,
    // New mechanics
    poisoned: false,                             // taking poison damage
    frozen: false,                               // slowed by ice
    frozenTimer: 0,                              // ticks remaining frozen
    blinded: false,                              // blinded by ink (reduces sense radius)
    blindedTimer: 0,                             // ticks remaining blinded
    infected: false,                             // turning into undead
    infectedTimer: 0,                            // ticks until zombie conversion
    stunned: false,                              // stunned by lightning
    stunnedTimer: 0,                             // ticks remaining stunned
    webbed: false,                               // trapped in spider web
    webbedTimer: 0,                              // ticks remaining webbed
    webX: 0, webY: 0,                            // web location
    sucked: false,                               // being pulled by tornado
    _dragonFireTimer: species.breathesFire ? Math.random() * CONFIG.DRAGON_FIRE_INTERVAL : 0,
    _inkTimer: 0,
    _fightTarget: null,
  };
}

export function updateEntity(entity, grid, canvasWidth, canvasHeight, entities, delta) {
  if (entity.dead) return;
  entity.age++;
  if (entity.reproductionCooldown > 0) entity.reproductionCooldown--;
  if (entity._fullCooldown > 0) entity._fullCooldown--;
  if (entity.frozenTimer > 0) { entity.frozenTimer--; entity.frozen = entity.frozenTimer > 0; }
  if (entity.blindedTimer > 0) { entity.blindedTimer--; entity.blinded = entity.blindedTimer > 0; }
  if (entity.stunnedTimer > 0) { entity.stunnedTimer--; entity.stunned = entity.stunnedTimer > 0; }
  if (entity.webbedTimer > 0) { entity.webbedTimer--; entity.webbed = entity.webbedTimer > 0; }
  if (entity.infectedTimer > 0) {
    entity.infectedTimer--;
    if (entity.infectedTimer <= 0) {
      // Convert to zombie!
      convertToZombie(entity, entities, grid);
      return;
    }
  }

  const species = SPECIES[entity.type];
  // Allow entity-level override of static (e.g., dragon fireballs that move)
  const isStatic = entity.static !== false && species.static;
  if (!species || isStatic) {
    // Static entities
    if (species.category === 'plant') updatePlant(entity, grid, entities);
    if (species.category === 'fire') updateFire(entity, grid, entities);
    if (species.category === 'water') updateWater(entity, grid, entities);
    if (species.category === 'lightning') updateLightning(entity, grid, entities);
    if (species.category === 'ice') updateIce(entity, grid, entities);
    if (species.category === 'tornado') updateTornado(entity, grid, entities);
    if (species.category === 'bomb') updateBomb(entity, grid, entities);
    if (entity.lifespan > 0) {
      entity.lifespan--;
      if (entity.lifespan <= 0) entity.dead = true;
    }
    return;
  }

  // ── Animals ────────────────────────────
  const speciesHungerRate = species.hungerRate ?? CONFIG.HUNGER_RATE;

  // Poison damage
  if (entity.poisoned) {
    entity.hp -= CONFIG.POISON_DAMAGE;
    if (entity.hp <= 0) { entity.dead = true; return; }
  }

  entity.hunger += speciesHungerRate;
  if (entity.hunger >= CONFIG.HUNGER_MAX) {
    entity.dead = true;
    return;
  }

  // Stunned — can't move, just sit there
  if (entity.stunned) {
    entity.state = 'stunned';
    return;
  }

  // Webbed — can't move
  if (entity.webbed) {
    entity.state = 'webbed';
    return;
  }

  // Dynamic sense radius: hungrier animals see farther, blinded animals see less
  // Also apply per-entity sense variance
  const hungerRatio = entity.hunger / CONFIG.HUNGER_MAX;
  let dynamicSenseRadius = species.senseRadius
    * (1 + hungerRatio * CONFIG.HUNGER_SENSE_RADIUS_MULTIPLIER)
    * (entity._senseRadiusMultiplier || 1);
  if (entity.blinded) dynamicSenseRadius *= 0.2;

  let speed = species.speed * CONFIG.MAX_SPEED_MULTIPLIER * (entity._speedMultiplier || 1);
  if (entity.frozen) speed *= CONFIG.ICE_SLOW_FACTOR;
  if (entity.sucked) speed *= 1.5; // tornado accelerates

  let ax = 0, ay = 0;
  entity.state = 'wander';

  // ── UNIFIED SHORT-RANGE QUERY ──
  // Do ONE queryRaw for seek + flock + reproduction (all within sense radius)
  const nearbyAll = grid.queryRaw(entity.x, entity.y, dynamicSenseRadius);

  // Priority 1: Flee — only at shorter range so prey doesn't panic across the map
  // Flee radius is a fraction of sense radius: threats must be fairly close.
  const fleeRadius = dynamicSenseRadius * CONFIG.FLEE_RADIUS_FRACTION;
  const nearbyFlee = (fleeRadius < dynamicSenseRadius)
    ? grid.queryRaw(entity.x, entity.y, fleeRadius)
    : nearbyAll;
  const fears = FLEES[entity.category];
  if (fears) {
    for (let i = 0; i < nearbyFlee.length; i++) {
      const other = nearbyFlee[i].entity;
      if (other === entity || other.dead) continue;
      if (fears.includes(other.category)) {
        const [fx, fy] = flee(entity, other);
        ax += fx;
        ay += fy;
        entity.state = 'flee';
        break;
      }
    }
  }

  // Priority 2: Seek food — only when hungry enough AND not full from a recent meal
  const isHungry = entity.hunger >= CONFIG.HUNGER_SEEK_THRESHOLD;
  const canEat = entity._fullCooldown <= 0;
  const shouldSeek = isHungry && canEat;

  const eatDistSq = CONFIG.EAT_DISTANCE * CONFIG.EAT_DISTANCE;

  if (entity.state !== 'flee' && shouldSeek) {
    const edible = EATS[entity.category];
    if (edible) {
      // Linear scan for nearest edible (avoid full sort)
      let bestIdx = -1;
      let bestDistSq = Infinity;
      for (let i = 0; i < nearbyAll.length; i++) {
        const other = nearbyAll[i].entity;
        if (other === entity || other.dead) continue;
        if (edible.includes(other.category) && nearbyAll[i].distSq < bestDistSq) {
          bestDistSq = nearbyAll[i].distSq;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        const other = nearbyAll[bestIdx].entity;
        const distSq = bestDistSq;
        if (distSq < eatDistSq) {
          // Eat it!
          other.dead = true;
          entity.hunger = CONFIG.HUNGER_EAT_ZERO;
          entity._fullCooldown = CONFIG.HUNGER_FULL_COOLDOWN;
          entity.state = 'eat';
          entity.targetId = null;
          entity._ateAt = { x: other.x, y: other.y };

          // Check if food had poison
          if (other.poisoned || (SPECIES[other.type] && SPECIES[other.type].poison)) {
            entity.poisoned = true;
            entity._poisonTimer = 200; // poison lasts 200 ticks
          }
        } else {
          const dist = Math.sqrt(distSq);
          const steeringFn = (entity.category === 'predator' || entity.category === 'undead') ? seek : (dist < 80 ? arrive : seek);
          const [sx, sy] = steeringFn(entity, other);
          ax += sx;
          ay += sy;
          entity.state = 'seek';
          entity.targetId = other.id;
        }
      }
    }
  }

  // Poison timer
  if (entity._poisonTimer !== undefined && entity._poisonTimer > 0) {
    entity._poisonTimer--;
    if (entity._poisonTimer <= 0) entity.poisoned = false;
  }

  // Priority 3: Sweep scan (THROTTLED — runs every 4 ticks per entity, staggered by id)
  if (entity._sweepSkip === undefined) entity._sweepSkip = Math.floor(Math.random() * 4);
  entity._sweepSkip = (entity._sweepSkip + 1) % 4;
  if (entity._sweepSkip === 0 && (entity.state === 'wander' || entity.state === 'full')) {
    const sweep = sweepScan(entity, grid, species, EATS[entity.category], fears);
    if (sweep.steering) {
      ax += sweep.steering[0];
      ay += sweep.steering[1];
      if (sweep.interest > 0.4) {
        entity.state = 'sweeping';
      }
    }
  }

  // Priority 4: Wander / Flocking
  if (entity.state === 'wander' || entity.state === 'sweeping' || entity.state === 'full') {
    if (!isHungry && entity._fullCooldown > 0) {
      entity.state = 'full';
    }
    const [wx, wy] = wander(entity, species);

    // Flocking for species that flock (reuse nearbyAll from unified query)
    let flockForce = [0, 0];
    if (species.flocking) {
      flockForce = flockingFromNearby(entity, nearbyAll);
    }

    if (entity.state === 'sweeping' && entity._sweepInterest > 0.3) {
      const sweepInfluence = entity._sweepInterest * 0.6;
      const sx = Math.cos(entity._sweepAngle) * CONFIG.WANDER_STRENGTH * sweepInfluence;
      const sy = Math.sin(entity._sweepAngle) * CONFIG.WANDER_STRENGTH * sweepInfluence;
      ax += wx * (1 - sweepInfluence) + sx + flockForce[0];
      ay += wy * (1 - sweepInfluence) + sy + flockForce[1];
    } else {
      ax += wx + flockForce[0];
      ay += wy + flockForce[1];
    }
  }

  // Tornado suction
  if (entity.sucked) {
    const suckStrength = 0.8;
    ax += (entity._suckX - entity.x) * 0.02 * suckStrength;
    ay += (entity._suckY - entity.y) * 0.02 * suckStrength;
  }

  // ── Apply steering acceleration ──
  entity.vx += ax;
  entity.vy += ay;

  // Clamp speed
  let vLen = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
  if (vLen > speed) {
    entity.vx = (entity.vx / vLen) * speed;
    entity.vy = (entity.vy / vLen) * speed;
  }

  // ── Wall avoidance — hard redirect BEFORE moving ──
  // If heading toward a wall, pick a direction away from it.
  const wallMargin = CONFIG.EDGE_BOUNCE_MARGIN;

  const nearLeft  = entity.x < wallMargin && entity.vx < 0;
  const nearRight = entity.x > canvasWidth - wallMargin && entity.vx > 0;
  const nearTop   = entity.y < wallMargin && entity.vy < 0;
  const nearBottom = entity.y > canvasHeight - wallMargin && entity.vy > 0;

  if (nearLeft || nearRight || nearTop || nearBottom) {
    let targetAngle;
    if (nearLeft && nearBottom) {
      targetAngle = -Math.PI / 4;                 // bottom-left → go up-right
    } else if (nearLeft && nearTop) {
      targetAngle = Math.PI / 4;                  // top-left → go down-right
    } else if (nearRight && nearBottom) {
      targetAngle = -Math.PI * 3 / 4;             // bottom-right → go up-left
    } else if (nearRight && nearTop) {
      targetAngle = Math.PI * 3 / 4;              // top-right → go down-left
    } else if (nearLeft) {
      targetAngle = (Math.random() - 0.5) * Math.PI;        // right hemisphere: [-π/2, π/2]
    } else if (nearRight) {
      targetAngle = Math.PI + (Math.random() - 0.5) * Math.PI; // left hemisphere: [π/2, 3π/2]
    } else if (nearTop) {
      targetAngle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // down hemisphere: [0, π]
    } else { // nearBottom
      targetAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // up hemisphere: [-π, 0]
    }

    entity.vx = Math.cos(targetAngle) * speed;
    entity.vy = Math.sin(targetAngle) * speed;
    entity._wanderAngle = targetAngle;
  }

  // Move
  entity.x += entity.vx;
  entity.y += entity.vy;

  // Safety clamp
  if (entity.x < 0) { entity.x = 0; entity.vx = Math.max(0, entity.vx); }
  if (entity.x > canvasWidth) { entity.x = canvasWidth; entity.vx = Math.min(0, entity.vx); }
  if (entity.y < 0) { entity.y = 0; entity.vy = Math.max(0, entity.vy); }
  if (entity.y > canvasHeight) { entity.y = canvasHeight; entity.vy = Math.min(0, entity.vy); }

  // ── Special per-species mechanics ──────

  // Dragon breathes fire
  if (species.breathesFire) {
    entity._dragonFireTimer--;
    if (entity._dragonFireTimer <= 0) {
      entity._dragonFireTimer = CONFIG.DRAGON_FIRE_INTERVAL + Math.random() * 200;
      breatheFire(entity, grid, entities);
    }
  }

  // Unicorn heals nearby allies
  if (species.heals) {
    unicornHeal(entity, grid);
  }

  // Spider leaves webs
  if (species.webs && entity.age % 100 === 0) {
    leaveWeb(entity, grid, entities);
  }

  // Octopus/Kraken ink
  if (species.inks) {
    entity._inkTimer--;
    if (entity._inkTimer <= 0 && entity.state === 'flee') {
      entity._inkTimer = 300;
      releaseInk(entity, grid, entities);
    }
  }

  // Zombie infection
  if (species.infectsTo && entity.state === 'seek') {
    infectNearby(entity, grid);
  }

  // Reproduction (reuse nearbyAll from unified query)
  if (Math.random() < CONFIG.REPRODUCTION_CHANCE) {
    tryReproduceFromNearby(entity, nearbyAll, entities);
  }
}

/** Plant: spawn fruit on interval */
function updatePlant(entity, grid, entities) {
  const species = SPECIES[entity.type];
  if (!species.spawns) return;
  entity.spawnTimer = (entity.spawnTimer || 0) + 1;
  if (entity.spawnTimer >= species.spawnEveryTicks) {
    entity.spawnTimer = 0;
    const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.PLANT_SPAWN_RADIUS);
    let fruitCount = 0;
    for (let j = 0; j < nearby.length; j++) {
      const e = nearby[j].entity;
      if (e.category === 'food') fruitCount++;
    }
    if (fruitCount < CONFIG.PLANT_MAX_FRUIT_NEARBY) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
      const fx = entity.x + Math.cos(angle) * dist;
      const fy = entity.y + Math.sin(angle) * dist;
      const fruit = createEntity(species.spawns, fx, fy);
      if (fruit) {
        // If poisonous plant, mark fruit too
        if (species.poison) fruit.poisoned = true;
        entities.push(fruit);
      }
    }
  }
}

/** Fire: spread, deal damage, burn plants */
function updateFire(entity, grid, entities) {
  // If this is a mobile fireball (dragon fire), move it
  if (entity.static === false) {
    entity.x += entity.vx || 0;
    entity.y += entity.vy || 0;
    entity.vx *= 0.995; // slow drag
    entity.vy *= 0.995;
  }

  const species = SPECIES[entity.type];
  const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.FIRE_SPREAD_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === entity || other.dead) continue;
    if (other.category === 'plant') {
      other.dead = true;
      addParticle(other.x, other.y, '🔥');
    }
    if (other.category === 'ice') {
      other.dead = true;
      addParticle(other.x, other.y, '💨');
    }
    // Burn animals
    if (other.hp !== undefined && other.category !== 'fire') {
      other.hp -= 0.05;
      if (other.hp <= 0) other.dead = true;
    }
  }
}

/** Water: extinguish fire */
function updateWater(entity, grid, entities) {
  const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.WATER_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === entity || other.dead) continue;
    if (other.category === 'fire') {
      other.dead = true;
      addParticle(other.x, other.y, '💨');
    }
  }
}

/** Lightning: periodic strikes that stun and damage */
function updateLightning(entity, grid, entities) {
  if (entity._strikeTimer === undefined) entity._strikeTimer = CONFIG.LIGHTNING_INTERVAL;
  entity._strikeTimer--;
  if (entity._strikeTimer <= 0) {
    entity._strikeTimer = CONFIG.LIGHTNING_INTERVAL + Math.random() * 200;
    // Strike at a random point near the lightning entity
    const strikeX = entity.x + (Math.random() - 0.5) * 200;
    const strikeY = entity.y + (Math.random() - 0.5) * 200;
    entity._lastStrike = { x: strikeX, y: strikeY };
    entity._strikeFlash = 10;

    const victims = grid.queryRaw(strikeX, strikeY, CONFIG.LIGHTNING_RADIUS);
    for (let j = 0; j < victims.length; j++) {
      const other = victims[j].entity;
      if (other === entity || other.dead) continue;
      if (other.hp !== undefined) {
        other.hp -= 2;
        if (other.hp <= 0) { other.dead = true; continue; }
      }
      // Stun
      other.stunned = true;
      other.stunnedTimer = 60;
    }
    // Stun in wider radius
    const stunVictims = grid.queryRaw(strikeX, strikeY, CONFIG.LIGHTNING_STUN_RADIUS);
    for (let j = 0; j < stunVictims.length; j++) {
      const other = stunVictims[j].entity;
      if (other.stunnedTimer < 30) {
        other.stunned = true;
        other.stunnedTimer = 30;
      }
    }
  }
  if (entity._strikeFlash > 0) entity._strikeFlash--;
}

/** Ice: freezes nearby entities */
function updateIce(entity, grid, entities) {
  const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.ICE_FREEZE_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === entity || other.dead) continue;
    if (other.category === 'fire') {
      other.dead = true;
      addParticle(other.x, other.y, '💨');
      continue;
    }
    if (other.frozenTimer !== undefined) {
      other.frozen = true;
      other.frozenTimer = Math.max(other.frozenTimer, 30);
    }
  }
}

/** Tornado: sucks entities in and flings them */
function updateTornado(entity, grid, entities) {
  const nearby = grid.query(entity.x, entity.y, CONFIG.ICE_FREEZE_RADIUS * 1.7);
  for (let j = 0; j < nearby.length; j++) {
    const { entity: other, dist } = nearby[j];
    if (other === entity || other.dead) continue;
    if (other.static) continue;
    // Pull toward center
    const dx = entity.x - other.x;
    const dy = entity.y - other.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    other.vx += (dx / len) * 0.4;
    other.vy += (dy / len) * 0.4;
    // Spin
    const perpX = -dy / len;
    const perpY = dx / len;
    other.vx += perpX * 0.3;
    other.vy += perpY * 0.3;
    // Damage if close
    if (dist < 30) {
      if (other.hp !== undefined) other.hp -= 0.1;
      if (other.hp <= 0) other.dead = true;
    }
  }
}

/** Bomb: countdown explosion */
function updateBomb(entity, grid, entities) {
  // Flash redder as lifespan decreases
  if (entity.lifespan < 60 && entity.lifespan % 10 === 0) {
    entity._flashBomb = true;
  }
  // Explode
  if (entity.lifespan <= 0) {
    const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.ICE_FREEZE_RADIUS * 1.4);
    for (let j = 0; j < nearby.length; j++) {
      const other = nearby[j].entity;
      if (other === entity) continue;
      if (other.hp !== undefined) {
        other.hp -= 5;
        if (other.hp <= 0) other.dead = true;
      }
      // Knockback
      const dx = other.x - entity.x;
      const dy = other.y - entity.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      other.vx += (dx / len) * 8;
      other.vy += (dy / len) * 8;
    }
    // Explosion particles handled in main.js via _explodedAt
    entity._explodedAt = { x: entity.x, y: entity.y };
  }
}

// ── Cached category sets for render ──
const ANIMAL_CATEGORIES = new Set(['herbivore', 'predator', 'undead', 'mythical', 'bug', 'bird', 'sea']);

// ── Special Ability Functions ────────────

function breatheFire(dragon, grid, entities) {
  // Spawn fire entity in front of dragon
  const angle = Math.atan2(dragon.vy, dragon.vx) || Math.random() * Math.PI * 2;
  const fx = dragon.x + Math.cos(angle) * 40;
  const fy = dragon.y + Math.sin(angle) * 40;
  const fireBall = createEntity('fire', fx, fy);
  if (fireBall) {
    fireBall.lifespan = 150;
    fireBall.vx = Math.cos(angle) * 1.5;
    fireBall.vy = Math.sin(angle) * 1.5;
    fireBall.static = false;
    fireBall.category = 'fire';
    entities.push(fireBall);
    addParticle(fx, fy, '🔥');
  }
}

function unicornHeal(unicorn, grid) {
  const nearby = grid.queryRaw(unicorn.x, unicorn.y, CONFIG.UNICORN_HEAL_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === unicorn || other.dead) continue;
    // Heal hunger
    if (other.hunger !== undefined && other.hunger > 10) {
      other.hunger = Math.max(10, other.hunger + CONFIG.UNICORN_HEAL_AMOUNT);
    }
    // Cure poison
    if (other.poisoned) {
      other.poisoned = false;
      other._poisonTimer = 0;
    }
  }
  // Sparkle effect
  if (unicorn.age % 60 === 0) {
    addParticle(unicorn.x + (Math.random() - 0.5) * 40, unicorn.y + (Math.random() - 0.5) * 40, '✨');
  }
}

function leaveWeb(spider, grid, entities) {
  const web = createEntity('plant', spider.x, spider.y);
  if (!web) return;
  // Use a plant as web marker with special props
  web.emoji = '🕸️';
  web.category = 'plant';
  web.static = true;
  web.lifespan = CONFIG.SPIDER_WEB_DURATION;
  web._isWeb = true;
  entities.push(web);

  // Trap nearby entities
  const nearby = grid.queryRaw(spider.x, spider.y, CONFIG.SPIDER_WEB_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === spider || other.dead) continue;
    if (other.category === 'bug') continue;
    if (other.static) continue;
    if (Math.random() < 0.3) {
      other.webbed = true;
      other.webbedTimer = 150;
      other.webX = spider.x;
      other.webY = spider.y;
    }
  }
}

function releaseInk(entity, grid, entities) {
  // Create ink cloud entities (fake plants that act as blinders)
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i + Math.random() * 0.5;
    const dist = 30 + Math.random() * 40;
    const ix = entity.x + Math.cos(angle) * dist;
    const iy = entity.y + Math.sin(angle) * dist;
    const ink = createEntity('plant', ix, iy);
    if (!ink) continue;
    ink.emoji = '🖤';
    ink.category = 'plant';
    ink.static = true;
    ink.lifespan = CONFIG.OCTOPUS_INK_DURATION;
    ink._isInk = true;
    entities.push(ink);
  }

  // Blind nearby predators
  const nearby = grid.queryRaw(entity.x, entity.y, CONFIG.OCTOPUS_INK_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === entity || other.dead) continue;
    if (other.category === 'predator' || other.category === 'undead' || other.category === 'mythical') {
      other.blinded = true;
      other.blindedTimer = CONFIG.OCTOPUS_INK_DURATION;
    }
  }
}

function infectNearby(zombie, grid) {
  const nearby = grid.queryRaw(zombie.x, zombie.y, CONFIG.ZOMBIE_INFECT_RADIUS);
  for (let j = 0; j < nearby.length; j++) {
    const other = nearby[j].entity;
    if (other === zombie || other.dead) continue;
    if (other.category === 'undead') continue;
    if (other.static) continue;
    if (!other.infected && other.category !== 'fire' && other.category !== 'water') {
      other.infected = true;
      other.infectedTimer = 300; // ~5 seconds until zombie conversion
      addParticle(other.x, other.y, '☠️');
      break;
    }
  }
}

function convertToZombie(entity, entities, grid) {
  const oldX = entity.x;
  const oldY = entity.y;
  entity.dead = true;
  // Spawn a zombie at the same position
  const zombie = createEntity('zombie', oldX, oldY);
  if (zombie) {
    entities.push(zombie);
    addParticle(oldX, oldY, '🧟');
  }
}

function tryReproduceFromNearby(entity, nearbyAll, entities) {
  if (entity.reproductionCooldown > 0) return;
  if (entities.length >= CONFIG.MAX_ENTITIES) return;

  const radSq = CONFIG.REPRODUCTION_RADIUS * CONFIG.REPRODUCTION_RADIUS;
  for (let i = 0; i < nearbyAll.length; i++) {
    const other = nearbyAll[i].entity;
    if (other === entity || other.dead) continue;
    if (other.type === entity.type && other.reproductionCooldown <= 0 && nearbyAll[i].distSq < radSq) {
      const mx = (entity.x + other.x) / 2;
      const my = (entity.y + other.y) / 2;
      const baby = createEntity(entity.type, mx + (Math.random() - 0.5) * 20, my + (Math.random() - 0.5) * 20);
      if (baby) {
        entities.push(baby);
        entity.reproductionCooldown = CONFIG.REPRODUCTION_COOLDOWN;
        other.reproductionCooldown = CONFIG.REPRODUCTION_COOLDOWN;
        addParticle(mx, my, '💕');
        break;
      }
    }
  }
}

// re-export for main.js
import { addParticle } from './render.js';

export { addParticle };
