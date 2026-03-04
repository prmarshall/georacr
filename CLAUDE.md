# Project: georacr

## Build & Dev

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Tech Stack

- **Framework:** React 19 + Vite + TypeScript
- **3D Engine:** Three.js + React Three Fiber (R3F)
- **Physics:** @react-three/rapier v2.2.0 (uses `@dimforge/rapier3d-compat` internally)
- **Helpers:** @react-three/drei
- **3D Tiles:** 3d-tiles-renderer v0.4.21 (NASA-AMMOS) — loads OGC 3D Tiles tilesets with R3F bindings
- **State Management:** Zustand v5 — lightweight store for UI/debug state
- **Styling:** SCSS + CSS Modules (`.module.scss`)
- **Imports:** `@/` alias maps to `src/` (configured in `tsconfig.app.json` + `vite.config.ts`)

## Project Structure

```
src/
├── App.tsx                              # Canvas, Physics, KeyboardControls, UI overlay
├── App.module.scss                      # Overlay UI styles (selector, reset button)
├── index.scss                           # Global reset (fullscreen, no overflow)
├── main.tsx                             # Entry point
├── vehicles/                            # Vehicle JSON configs (auto-discovered)
│   ├── sedan.json
│   ├── sports.json
│   └── tractor.json                     # Slow debug vehicle
├── stores/
│   └── useDebugStore.ts                 # Zustand store: debug toggle state
├── tiles/
│   ├── Tiles3D.tsx                      # 3D Tiles renderer component
│   ├── useTileColliders.ts              # Trimesh colliders from tile meshes + bbox walls
│   └── CachedGoogleCloudAuthPlugin.ts   # Google Cloud auth (unused, kept for reference)
├── components/
│   ├── Floor.tsx                        # Checkerboard ground (unused, replaced by 3D Tiles)
│   ├── DebugPanel.tsx                   # Gear icon + toggle panel for debug visuals
│   ├── DebugPanel.module.scss
│   ├── MarsSky.tsx                      # GLSL gradient skybox
│   ├── HUD.tsx                          # HUD orchestrator (Speedometer + Stopwatch)
│   ├── HUD.module.scss
│   ├── Speedometer.tsx                  # mph + km/h, ref-based updates
│   ├── Stopwatch.tsx                    # Elapsed time, contains ZeroToSixty
│   ├── ZeroToSixty.tsx                  # 0-60 mph timer
│   ├── UIButton.tsx                     # Non-focusable button (tabIndex=-1)
│   ├── UIButton.module.scss
│   ├── ThirdPersonCamera.tsx            # Unused
│   └── Vehicle/
│       ├── Vehicle.tsx                  # Orchestrator: refs, Rapier API, brake lights, JSX
│       ├── vehiclePhysics.ts            # Pure functions: engine, drivetrain, drag, steering
│       ├── useChaseCamera.ts            # Chase camera hook (mouse orbit, GTA5-style)
│       ├── useVehicleController.ts      # Rapier DynamicRayCastVehicleController wrapper
│       ├── vehicleConfig.ts             # Types, parseVehicleJSON(), loadVehicleEntry()
│       └── vehicles.ts                  # Auto-discovers src/vehicles/*.json
```

## Guidelines

- Use functional components with TypeScript
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`)
- **Rapier body validity:** Always guard shared `RigidBody` refs with `body.isValid()` before calling any method. Stale refs after remount crash WASM with "unreachable"
- All vehicle physics tunables go in JSON files, not hardcoded in components
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera
- All overlay UI buttons must use `UIButton` (tabIndex=-1, preventDefault). Never raw `<button>`
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for imports
- **Refs vs state:** Refs + `textContent` for per-frame updates (60fps). `useState` for discrete events that trigger re-renders. Never read refs during render (React 19 strict mode)
- **Coordinate convention:** -Z is forward (Three.js default). Do NOT change to +Z forward

## Git Commit Protocol

- **Use `git commit -m`:** Quoted commit messages are safe — `bash_guard.py` strips quoted strings before checking for shell operators.
- **Stage with `safe_add.py`:** Use `python3 .claude/hooks/safe_add.py <files>` instead of bare `git add`.
- **Atomic actions:** Never chain commands with `&&`. Perform staging and committing as separate Bash calls.

## Strict Terminal Protocol

- **Atomic commands only:** Do not use command chaining operators (`;`, `&&`, `||`, `|` except for `grep`/`tail`).
- **One tool per step:** Perform `git add` and `git commit` as two separate Bash tool calls.
- **No heredocs:** Do not use `cat <<EOF`. If you need to write multi-line content, use the Write or Edit tools instead of the terminal.

## Future: Extractable Packages

The **LOD-aware physics sync** system in `src/tiles/useTileColliders.ts` is novel and intended to be extracted into standalone open-source packages:

- `3d-tiles-colliders-rapier` — Three.js + Rapier version
- `3d-tiles-colliders-cannon` — Three.js + Cannon-es version (port)

**Core algorithm (shared concept, not shared code):** Per-frame mesh diffing against a tile group by UUID, vertex extraction with world matrix baking into trimesh colliders, and collider lifecycle management (create on tile load, destroy on tile unload). Each package is self-contained — no shared abstraction layer between physics backends.

**Not included in packages:** The dual LOD camera system and vehicle-specific logic stay in georacr. The packages only handle tileset → physics collider sync.

## Detailed Rules (`.claude/rules/`)

Path-scoped rules loaded on demand when working with matching files:

- `vehicle-physics.md` — Vehicle system: controller, brakes, steering, tire physics, HUD
- `vehicle-tuning.md` — Tuning guide, density scaling, coordinate convention details
- `tiles-terrain.md` — 3D Tiles, collision system, LOD camera system
- `scene-camera-ui.md` — Rendering, camera, HUD, Zustand patterns, UI conventions
- `rapier-api.md` — DynamicRayCastVehicleController full API reference
