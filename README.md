# 🏝️ Emoji Sandbox

A browser-based life-simulation toy. Pick emojis from a tray and drop them onto a canvas to watch them interact.

**How to run locally:**
```bash
# Option 1 — just open the file
open index.html

# Option 2 — use a local dev server (recommended for modules)
npx serve .
```

**Live:** `https://<username>.github.io/emoji-sandbox/`

---

## How it works

- **🐰 Herbivores** (rabbit, mouse, deer) wander, get hungry, and seek carrots/apples/berries to eat.
- **🦊 Predators** (fox, wolf, cat) hunt herbivores; herbivores flee when they sense danger.
- **🌱 Plants** spawn fruit periodically, sustaining herbivores indefinitely if enough are placed.
- **🔥 Fire** spreads to plants and burns out after its lifespan.
- **💧 Water** extinguishes fire within its radius, then evaporates.

All behavior is data-driven — add new species in `js/rules.js` without writing new code.

---

## Project structure

```
emoji-sandbox/
├── index.html           # entry point
├── css/style.css        # all styles
├── js/
│   ├── main.js          # boot, game loop, input handling
│   ├── config.js        # tuning constants
│   ├── rules.js         # species & behavior tables
│   ├── entity.js        # entity factory + per-tick update
│   ├── behaviors.js     # wander / seek / flee steering
│   ├── grid.js          # spatial hash grid
│   ├── render.js        # canvas drawing + particles
│   ├── storage.js       # localStorage save/load
│   └── ui.js            # tray, top bar, UI state
└── README.md
```

---

## Phases

See the [handoff plan](./emoji-sandbox-handoff-plan.md) for the full roadmap.

- **Phase 1 (MVP):** Canvas, entities, wander/seek/flee, hunger/death ✅
- **Phase 2:** Plants, fire, water, tools, balance
- **Phase 3:** Persistence, particles, performance
- **Phase 4:** Share links (AWS backend, optional)
