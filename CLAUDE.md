# Project: roadglobe

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
│   ├── default.json
│   └── sports.json
├── components/
│   ├── Floor.tsx                        # 1000x1000 checkerboard ground plane
│   ├── UIButton.tsx                     # Non-focusable button (tabIndex=-1, preventDefault)
│   ├── UIButton.module.scss
│   ├── ThirdPersonCamera.tsx            # Unused (camera is inline in Vehicle)
│   └── Vehicle/
│       ├── Vehicle.tsx                  # Main component: controls, camera, reset
│       ├── useVehicleController.ts      # Hook wrapping Rapier's DynamicRayCastVehicleController
│       ├── vehicleConfig.ts            # Types, parseVehicleJSON(), loadVehicleEntry(), createWheels()
│       └── vehicles.ts                 # Auto-discovers src/vehicles/*.json, exports VEHICLES
```

## Vehicle System

Based on [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

- **Controller:** Rapier's built-in `DynamicRayCastVehicleController` via `world.createVehicleController(chassis)`. Do NOT use manual raycast suspension or Hooke's Law.
- **Drive:** FWD (engine on wheels 0, 1). Wheels 2, 3 are rear.
- **Orientation:** X-forward. `axleCs: (0, 0, -1)`. Wheel visual rotation: `rotation-x={-Math.PI/2}`.
- **Deceleration:** Rolling resistance (constant brake when no throttle) + air drag (brake proportional to speed²). Tuned in `vehicleConfig.ts`.
- **Controls:** WASD + Space (brake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.
- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/` — no code changes needed.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` files via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime, replacing unsafe type casts and catching malformed configs early.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.

## Camera

- Inline in `Vehicle.tsx` (not a separate component).
- **Grounded:** Follows behind chassis using `matrixWorld` offset.
- **Airborne:** Tracks velocity direction.
- **Smoothing:** Uses `1.0 - 0.01 ** delta` for frame-rate-independent lerp.

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in JSON files, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
- All overlay UI buttons must use the `UIButton` component which prevents focus via `tabIndex={-1}` and `onMouseDown={preventDefault}`. Never use raw `<button>` in overlay UI.
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for cross-directory imports.
