# Emoji Sandbox — Project Handoff Plan

**Version:** 1.0 · **Date:** July 2026 · **Status:** Ready for development

---

## 1. Project Summary

Emoji Sandbox is a browser-based life-simulation toy inspired by elemental sandbox games. The user picks emojis from a tray at the bottom of the screen and drops them onto a canvas. Each emoji has behaviors: animals wander and seek food, predators hunt prey, fire spreads to plants, water extinguishes fire, and so on. The simulation runs entirely client-side.

**Key decisions already made:**

| Decision | Choice | Rationale |
|---|---|---|
| Movement model | Free/smooth (boids-lite steering) | Feels alive; chosen by owner |
| Persistence (v1) | localStorage + named save slots | No backend needed for launch |
| Frontend hosting | GitHub Pages | Free, no build step required |
| Backend (v2+) | AWS Lambda + API Gateway + DynamoDB | Only for share links; free tier sufficient |
| Rendering | HTML5 Canvas, vanilla JS | No framework/build tooling; PixiJS optional later |

---

## 2. Architecture

### 2.1 Frontend (all of v1)

- Single-page app: `index.html` + JS modules, no build step.
- Game loop via `requestAnimationFrame`, fixed-timestep update (e.g. 60 updates/sec) with rendering decoupled from simulation ticks.
- Entities stored in a flat array; a spatial hash grid (cell size ≈ sense radius) accelerates nearest-neighbor queries.
- Emojis rendered as text on canvas (`ctx.fillText`) or pre-rendered to offscreen sprites for performance at 500+ entities.

### 2.2 Backend (v2, deferred)

- `POST /sandbox` → Lambda → DynamoDB: stores serialized sandbox JSON, returns short ID.
- `GET /sandbox/{id}` → Lambda → DynamoDB: returns JSON for loading via share link (`?s=abc123`).
- The localStorage save format IS the API payload — design it once.

---

## 3. Data Model

### 3.1 Entity

```js
{
  id: string,          // uuid or counter
  emoji: "🐰",
  category: "herbivore", // lookup key into rules table
  x: number, y: number,
  vx: number, vy: number,
  hunger: number,      // 0–100, rises per tick
  state: "wander",     // wander | seek | flee | eat | dead
  targetId: string|null,
  age: number,         // ticks alive
  hp: number           // optional, for fire/damage
}
```

### 3.2 Rules table (`rules.js`) — the heart of the project

All behavior is data-driven. Adding a new emoji must never require new if-statements.

```js
const SPECIES = {
  carrot:   { emoji: "🥕", category: "food",      static: true },
  apple:    { emoji: "🍎", category: "food",      static: true },
  rabbit:   { emoji: "🐰", category: "herbivore", speed: 1.6, senseRadius: 150 },
  mouse:    { emoji: "🐭", category: "herbivore", speed: 1.9, senseRadius: 120 },
  fox:      { emoji: "🦊", category: "predator",  speed: 2.2, senseRadius: 180 },
  wolf:     { emoji: "🐺", category: "predator",  speed: 2.0, senseRadius: 220 },
  plant:    { emoji: "🌱", category: "plant",     static: true, spawns: "apple", spawnEveryTicks: 600 },
  fire:     { emoji: "🔥", category: "fire",      spreadsTo: "plant", radius: 60, lifespanTicks: 300 },
  water:    { emoji: "💧", category: "water",     extinguishes: "fire", radius: 80, lifespanTicks: 400 }
};

const EATS = {
  herbivore: ["food"],
  predator:  ["herbivore"]
};

const FLEES = {
  herbivore: ["predator"]
};
```

### 3.3 Save format (localStorage AND future API payload)

```js
{
  version: 1,
  savedAt: ISOString,
  name: "My savanna",
  tick: number,
  entities: [ /* array of entity objects */ ]
}
```

Stored under keys `emojisandbox:save:<slotName>`; autosave under `emojisandbox:autosave`.

---

## 4. Behavior Specification

Priority order each tick (first match wins):

1. **Flee** — if any feared category within senseRadius, steer directly away at max speed.
2. **Seek** — if hunger > 50, find nearest edible entity in senseRadius via spatial grid; steer toward it. On contact (< 16px): remove target, hunger → 0, emit 💨 particle.
3. **Wander** — add a small random steering force; clamp to species max speed; soft-bounce off canvas edges.

**Passive systems (run per tick):**
- Hunger +0.05/tick for animals; at hunger = 100 the entity dies (fade out).
- Plants spawn their fruit within a 40px radius on their spawn interval (cap nearby fruit at 3).
- Fire ignites plants within radius (converts to fire), dies after lifespan.
- Water removes fire within radius, then evaporates after lifespan.
- Optional stretch: reproduction when two same-species animals are well-fed and adjacent (spawn 1 child, cooldown timer).

**Tuning constants** live in one `config.js` file so the balance pass is easy.

---

## 5. UI Specification

- **Canvas**: fills viewport above the tray. Tap/click places the selected emoji at that point. Drag to place continuously (throttle ~1 per 100ms).
- **Bottom tray**: horizontally scrollable row of emoji buttons; selected one is highlighted. Include an eraser 🧽 tool (removes entities in a radius) and a clear-all 🗑 with confirm.
- **Top bar (minimal)**: pause/play, speed toggle (1x/2x), entity counter, save/load menu (slot list from localStorage), mute.
- **Mobile-first**: touch events, tray buttons ≥ 44px, canvas resizes on orientation change (preserve entity positions proportionally).

---

## 6. Repository & File Structure

```
emoji-sandbox/
├── index.html
├── css/style.css
├── js/
│   ├── main.js        # boot, game loop, resize handling
│   ├── config.js      # all tuning constants
│   ├── rules.js       # SPECIES / EATS / FLEES tables
│   ├── entity.js      # entity factory + update logic
│   ├── behaviors.js   # wander / seek / flee steering
│   ├── grid.js        # spatial hash
│   ├── render.js      # canvas drawing + particles
│   ├── storage.js     # save/load/autosave (localStorage)
│   └── ui.js          # tray, top bar, input handling
├── README.md
└── .github/workflows/pages.yml   # optional; Pages can deploy from branch directly
```

---

## 7. Milestones & Task Breakdown

### Phase 1 — MVP (target: 1–2 weeks part-time)
1. Repo scaffold, canvas boot, game loop with pause/play.
2. Emoji tray UI + tap-to-place.
3. Entity system + wander behavior with edge bounce.
4. Spatial grid + seek/eat (herbivore → food).
5. Flee behavior (herbivore ← predator) + predator hunting.
6. Hunger + death.
7. **Acceptance:** place 🥕 and 🐰; rabbit wanders, gets hungry, walks to carrot, eats it. Place 🦊; rabbit flees, fox catches it.

### Phase 2 — Ecosystem
8. Plants spawning fruit; fire spread; water extinguishing.
9. Eraser + clear-all tools; speed toggle; entity counter.
10. Balance pass on config constants.
11. **Acceptance:** a placed 🌱 garden sustains 3 rabbits indefinitely; 🔥 wipes a plant cluster unless 💧 is placed.

### Phase 3 — Persistence & polish
12. storage.js: autosave every 5s, named slots, load menu.
13. Particles (💨 on eat, ✨ on spawn), optional sound (muted by default).
14. Performance check: 500 entities at 60fps on a mid-range phone (pre-render emoji sprites if needed).
15. **Acceptance:** refresh the page → autosave restores the world; saving/loading named slots works.

### Phase 4 — Share links (backend, optional)
16. AWS: DynamoDB table `sandboxes` (pk: id, TTL 90 days), two Lambdas behind API Gateway (or one Lambda function URL), CORS locked to the Pages domain.
17. Frontend: Share button → POST save JSON → copy link `https://<user>.github.io/emoji-sandbox/?s=<id>`; on load with `?s=`, GET and hydrate.
18. Basic abuse guardrails: 100KB payload cap, rate limit via API Gateway.
19. **Acceptance:** share link opens the exact saved world in an incognito window.

---

## 8. Deployment Steps (GitHub Pages)

1. Create public repo `emoji-sandbox` on GitHub.
2. Push code to `main`.
3. Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / root.
4. Site is live at `https://<username>.github.io/emoji-sandbox/` within ~1 minute of each push. No build step, no Actions workflow required.
5. (Phase 4) Deploy backend separately: AWS SAM or a small CDK/Console setup; note that the API URL goes into `config.js`.

---

## 9. Handoff Steps

Follow these in order when handing the project to a developer:

1. **Share this document** plus any sketches/mockups of the tray UI.
2. **Create the GitHub repo** under the owner's account and add the developer as a collaborator (Settings → Collaborators). Owner keeps admin; developer gets write.
3. **Seed the repo** with the file structure in §6 (empty stubs are fine) and a README containing: project one-liner, link to this plan, how to run locally (`open index.html` or `npx serve`), and the Pages URL.
4. **Enable GitHub Pages** (steps in §8) before development starts, so every merge to `main` is immediately testable on a real phone.
5. **Agree on workflow**: feature branches + PRs to `main`; each phase's acceptance criteria (§7) is the definition of done; owner reviews acceptance on the live Pages URL.
6. **Create GitHub Issues** — one per numbered task in §7, labeled by phase (`phase-1`, `phase-2`, …). This plan's task numbers map 1:1 to issues.
7. **Set the review cadence**: async check-in at the end of each phase; owner plays with the live build and files bugs as issues.
8. **Defer AWS access** until Phase 4. When reached: create an AWS account (or IAM user) with least-privilege access to Lambda/API Gateway/DynamoDB; never commit AWS keys — the frontend only needs the public API URL.
9. **Handoff-back checklist** (developer → owner at project end): README updated, config constants documented, all issues closed or triaged, Pages live, (Phase 4) AWS resources tagged `emoji-sandbox` with cost alarm set at $5/month.

---

## 10. Risks & Notes

- **Emoji rendering varies by OS** (Apple vs Google vs Windows emoji sets). Acceptable for v1; a fixed emoji font (e.g. Noto Emoji via canvas sprites) is a later polish option.
- **Performance**: `fillText` per emoji per frame is the likely first bottleneck; the fix (pre-rendered offscreen sprites) is planned in task 14.
- **Scope creep**: reproduction, weather, day/night are tempting — park them in a `v3-ideas` issue label. The rules-table design means none of them require rearchitecting.
- **No accounts, no PII**: share links are anonymous, content is emoji positions only — keeps the backend trivially safe.
