# Memory

See @README.md for project overview and screenshots, @package.json for scripts and dependencies.

## Project Overview

SUPAPLEX — AAA Remastered: enterprise-grade Supaplex clone (eat dirt, push zonks,
harvest infotrons, detonate disks, ride gravity ports, reach exit). Webpack 5 +
TypeScript (strict) + Three.js r160. No game assets — all textures procedurally
generated on canvas, all audio synthesized with WebAudio. Six handcrafted levels.
Live: https://victorzakharov.github.io/supaplex-muse13/

## Commands

```bash
npm install
npm run dev     # webpack serve + open, http://localhost:8080, hot reload, error overlay
npm run build   # production bundle in dist/ (contenthash, source-map)
npm run build:dev
npm run typecheck  # tsc --noEmit
npm run clean      # rimraf dist
npm run deploy     # gh-pages -d dist (GitHub Pages, publicPath './')
```

- Node >= 18. No tests, no linter configured.
- Dev server: `webpack.dev.js` (eval-cheap-module-source-map, port 8080).
  Prod: `webpack.prod.js` (source-map, perf budget 3MB).

## Tech Stack / Build

- `three@^0.160.0` (+ `@types/three`), `ts-loader`, `html-webpack-plugin`
  (template `src/index.html`), `style-loader`+`css-loader`, `webpack-merge`, `gh-pages`.
- `tsconfig.json`: target ES2020, module ESNext, moduleResolution bundler,
  lib ES2020+DOM, strict, esModuleInterop, baseUrl `src`, path aliases
  `@core/* @game/* @gfx/* @ui/*` (duplicated as webpack `resolve.alias` in
  `webpack.common.js`). Entry `./src/main.ts`, output `dist/bundle.[contenthash].js`.
- `src/index.html` shell: `#app > canvas#game-canvas + #vignette + #scanlines + #hud + #overlay`.

## Architecture

```
src/
├── main.ts        # boot(): get #game-canvas, new Game(canvas), on DOMContentLoaded
├── core/          # Config, EventBus, Logger, InputManager
├── game/          # Tiles, LevelGrid, Levels, PhysicsEngine, GameSession, Events, AudioEngine, Game
├── gfx/           # MaterialFactory, TextureFactory, TileMeshBuilder, LightingRig,
│                  # ParticleSystem, BackgroundDome, WorldRenderer
├── ui/            # Hud, styles.css
└── index.html
```

- `Game` (src/game/Game.ts) owns everything: `GameSession` + `InputManager` +
  `AudioEngine` + `Hud` + `WorldRenderer`. Wires session bus events to renderer /
  audio / HUD toasts, handles overlays (title / pause / dead / levelComplete /
  gameComplete), runs the rAF loop.
- Main loop (`Game.loop`): rAF, dt clamped to 0.05s. If `playing`: consume input,
  throttle moves by `Config.playerMoveInterval` (0.11s), Space-held = grab mode;
  `session.update(dt, tickRate)`; `hud.update`; `syncOverlay`; `renderer.update(...)`;
  `renderer.render()`. Non-playing phases drain input queues.
- Cross-cutting: `EventBus` (`on` returns unsubscribe, `emit`, `clear`) carries
  `GameEvents`; `Logger` static, level Info, `[supaplex]` prefix.
- Rendering is a view of the grid: `GameSession`/`PhysicsEngine` own state,
  `WorldRenderer` mirrors `LevelGrid` into Three.js meshes + particles.

## Simulation

- `core/Config.ts` (all `as const`): tickRate 12, tileSize 1, gravityRollEnabled true,
  orangeFuseTicks 10, yellowFuseTicks 14, chainFuseTicks 2, explosionRadius 1,
  portPeriodTicks 26, cameraLerp 6, meshLerp 14, tileLerp 14,
  playerMoveInterval 0.11, cameraViewHeight 12.
- `game/Tiles.ts`: `Tile` enum Empty 0, Dirt 1, Wall 2, Rock(Zonk) 3, Infotron 4,
  OrangeDisk 5, PortUp/Down/Left/Right 6-9, Electron 10, Player(Murphy) 11,
  Base 12, Exit 13, YellowDisk 14. `TILE_DEFS`: Rock/Infotron heavy+round,
  Orange/Yellow heavy+explosive, Ports solid, Dirt edible, Wall solid.
- `game/LevelGrid.ts`: `LevelSpec { name, required, rows }`, glyph map
  `space Empty . Dirt # Wall O Rock * Infotron X Orange Y Yellow ^v<> Ports
  ~ Electron @ Player = Base E Exit`. `LevelGrid` parses rows into `Uint8Array`,
  records `playerX/Y` (`@` becomes Empty) and `exitX/Y`. OOB `get` returns Wall,
  OOB `set` is a no-op.
- `game/Levels.ts`: 6 levels built with `border()`+`row()` helpers on a dirt field
  with wall border: 1 BOOT SECTOR (req 6, 30 wide), 2 GRAVITY WELLS (10, 32),
  3 ORANGE PROTOCOL (8, 32), 4 PORT AUTHORITY (9, 34), 5 YELLOW FEVER (12, 34),
  6 CORE MELTDOWN (14, 36).
- `game/PhysicsEngine.ts` (fixed step, 12 ticks/sec):
  - `tryMovePlayer`: Dirt/Base eaten; Infotron/Electron collected (infotron counts);
    Exit emits `exit`; Empty moves; Rock pushed horizontally into Empty only;
    Orange/Yellow pushed via `tryPushDisk` (must land on Empty, arms fuse:
    orange 10 / yellow 14 ticks, emits `fuse`); vertical Rock blocked.
  - `grabTile` (Space, facing dir): Dirt/Base eaten in place, Infotron collected
    in place, Orange/Yellow detonate immediately (radius 1).
  - `step`: updateFuses → applyGravity → cyclePorts.
  - `explode`: 3x3 clear except Wall/Exit/Base; other disks get chain fuse (2 ticks);
    destroyed ports emit cyan `port` explosions.
  - `applyGravity`: bottom-up scan, alternating direction per row. Only Rock/Infotron
    fall (disks never fall). Falls into Empty; crushes Murphy only if the rock was
    already falling (`death: crushed by falling zonk`). Rolls off round/Rock/
    Infotron/Wall stacks sideways (alternating by `(x+y+tick)%2`) if side and
    below-side are Empty.
  - `cyclePorts` (every 26 ticks): each port raycasts along its direction to the
    first Electron/Wall; Rock/Infotron there vaporize; Murphy there is teleported
    to adjacent Empty/Dirt/Base or dies (`sizzled by gravity port`).
- `game/GameSession.ts`: phases `ready | playing | dead | won | levelComplete |
  gameComplete | paused`. Fixed-step accumulator (max 4 substeps/tick). `loadLevel`
  resets grid/physics/counters (phase `ready`); `start` ready/paused→playing;
  `applyPlayerIntent(dir, grab)` — grab uses `dir ?? lastGrabDir ?? down`;
  `checkExit` emits `exitOpen` once when `collected >= required`; stepping on a
  closed exit emits `blocked`. `advanceLevel` (last → `gameComplete`), `retry`
  (same level, playing). Debug `KeyN` in `Game` skips via `advanceLevel`.
- `game/Events.ts` (`GameEvents`): explosion {x,y,radius,color,kind},
  collect {infotron|electron}, eat, push, blocked, exitOpen, exit, death {cause},
  teleport {from→to}, fuse {orange|yellow}, portCycle, win.

## Rendering (gfx/)

- `WorldRenderer`: orthographic camera (-8..8, 6..-6, view height 12), pixelRatio
  capped at 2, PCFSoft shadows, `NoToneMapping`, EffectComposer
  RenderPass + UnrealBloomPass(0.32, 0.7, 0.55) + OutputPass with raw-render
  fallback. Owns MaterialFactory, TileMeshBuilder, LightingRig, BackgroundDome
  (hidden: `group.visible = false`), ParticleSystem, tile/fx layers, Murphy mesh,
  shockwaves, flash light, screen shake. Key methods: `loadLevel`,
  `explosion`, `collectSparkle`, `dirtPuff`, `teleportSparkle`, `addShake`,
  `setFacing`, `update`, `render`.
- `TileMeshBuilder`: cached geometries (box, sphere, disk, orb, port, murphy,
  exit); per-tile groups with cast+receive shadows; `buildMurphy`.
- `MaterialFactory`: cached `MeshStandardMaterial` neon PBR materials.
- `TextureFactory`: seeded (`mulberry32`) canvas textures (grass/rock/wall),
  sRGB + Repeat + aniso 4, cached.
- `LightingRig`: ambient + hemisphere + shadow key light (1024 map) + pulsing cyan
  rim + pink point light following Murphy (`followPlayer`/`update`).
- `ParticleSystem`: max 2400 additive Points, `burst(x, y, color, count, speed...)`.
- `BackgroundDome`: 900-star Points + animated shader nebula + grid (currently hidden).

## Audio / UI / Input

- `game/AudioEngine.ts`: lazy AudioContext (webkit fallback, `unlock()` on any key
  for autoplay policy), master gain 0.32, `toggleMute`. `tone`+`noise` primitives;
  eat/collect/push/blocked/explosion/teleport/exitOpen/win/death/click SFX;
  `startMusic` bass loop `[55,55,65.4,49,55,55,73.4,65.4]` every 240ms (starts on
  game start, guarded against double-start).
- `ui/Hud.ts`: builds `#hud` (brand, LEVEL x/6 + name, INFOTRONS n/req + bar,
  MOVES, EXIT LOCKED/OPEN) + controls hint + toast (default 2200ms); overlays
  rendered into `#overlay .panel` via `showOverlay`/`hideOverlay`.
- `core/InputManager.ts`: Arrows/WASD buffered + held set, facing defaults down;
  key repeat ignored. Space = actionQueued + actionHeld (+ listeners); P/Esc =
  pause listeners; any-key listeners (audio unlock). `consumeDirection` prefers
  the buffered press, then held keys; `consumeAction`, `isActionHeld`, `getFacing`.
- Controls: Arrows/WASD move · Space grab/detonate adjacent + confirm dialogs ·
  P/Esc pause · R retry · N skip level (debug) · M mute.
- `Game` key handling: Space advances ready/dead/levelComplete/gameComplete states;
  R retries + rebuilds meshes; N skips; M mutes. Title overlay button
  `#start-btn` (INITIALIZE MURPHY) starts music + session.

## Conventions / Gotchas

- Path aliases `@core/@game/@gfx/@ui` must stay in sync between `tsconfig.json`
  and `webpack.common.js`.
- Simulation is headless (`GameSession`+`PhysicsEngine` have no Three.js); keep it
  that way — renderer/audio/HUD only react to bus events + snapshots.
- Death causes are user-visible strings (`crushed by falling zonk`,
  `sizzled by gravity port`) — `Game` uppercases them into toasts/overlays.
- `Hud` uses non-null `getElementById('hud')!` — element ids in `index.html`
  (`game-canvas, hud, overlay`) are load-bearing (`main.ts`, `Game`, `Hud`).
- Level rows may vary in length; `LevelGrid` pads with Empty (width = longest row).
- No tests/lint — verify with `npm run typecheck` and `npm run build`.

## Branching / Merge Policy (CI-enforced)

- `main` accepts only merge commits (repo allows merge commits, squash/rebase disabled).
- PR branches must be linear: `.github/workflows/branch-policy.yml` fails the PR
  if its range contains any merge commit. Rebase instead:
  `git fetch origin && git rebase origin/main`.
- `main` branch protection requires the `linear-history` check + PR review before merging.
