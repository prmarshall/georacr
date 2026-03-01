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
│   ├── sports.json
│   ├── muscle.json                      # GLB model vehicle (model: /models/car/muscle.glb)
│   └── tractor.json                     # Slow debug vehicle
├── components/
│   ├── Floor.tsx                        # 1000x1000 checkerboard ground plane
│   ├── UIButton.tsx                     # Non-focusable button (tabIndex=-1, preventDefault)
│   ├── UIButton.module.scss
│   ├── ThirdPersonCamera.tsx            # Unused (camera is inline in Vehicle)
│   └── Vehicle/
│       ├── Vehicle.tsx                  # Main component: controls, camera, reset
│       ├── useVehicleController.ts      # Hook wrapping Rapier's DynamicRayCastVehicleController
│       ├── VehicleModel.tsx             # GLB model loader, discovers Wheel_1..N positions
│       ├── vehicleConfig.ts            # Types, parseVehicleJSON(), loadVehicleEntry(), createWheels()
│       └── vehicles.ts                 # Auto-discovers src/vehicles/*.json, exports VEHICLES
```

## Vehicle System

Based on [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

- **Controller:** Rapier's built-in `DynamicRayCastVehicleController` via `world.createVehicleController(chassis)`. Do NOT use manual raycast suspension or Hooke's Law.
- **Drive:** FWD — engine force on wheels 2, 3 (front). Wheels 0, 1 are rear.
- **Deceleration:** Rolling resistance (constant brake when no throttle) + air drag (brake proportional to speed²).
- **Controls:** WASD + Space (brake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.
- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, optional `model` (GLB path), and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/` — no code changes needed.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` files via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime, replacing unsafe type casts and catching malformed configs early.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.
- **GLB Models:** `VehicleModel.tsx` loads GLB via `useGLTF`. Wheels must be named `Wheel_1`, `Wheel_2`, etc. Positions are discovered at runtime via `getWorldPosition()` + `scene.worldToLocal()` (NOT `node.position`, which is relative to parent, not scene root). For model vehicles, wheel/controller creation is deferred until the model reports positions (avoids throwaway controller).

### Coordinate Convention: -Z Forward (Three.js Default)

**This is critical. Do NOT change to +Z forward.**

- **Forward direction:** -Z (Three.js right-handed default)
- **Axle:** `axleCs: [1, 0, 0]` (X axis)
- **Rapier forward:** `cross(axle, suspension)` = `cross((1,0,0), (0,-1,0))` = `(0, 0, -1)` = -Z
- **Engine force:** Positive = forward (-Z). Do NOT negate engine force. Negating breaks Rapier's `wheelRotation()` accumulation — wheels won't visually spin.
- **Wheel order in JSON placements:** indices 0,1 = rear (+Z), indices 2,3 = front (-Z)
- **Wheel visual:** `rotation-z={-Math.PI / 2}` orients cylinder along X axle
- **Blender alignment:** Blender +Y forward → glTF exporter maps to -Z forward automatically

### Wheel Spin (Visual Rotation)

- **Rapier's `wheelRotation()` is broken** for straight-line driving — its internal `currentVehicleSpeed()` oscillates sign, causing accumulated rotation to cancel out. Do NOT use `wheelRotation()`.
- **Fix:** Manual accumulator in `useVehicleController.ts` computes forward speed from chassis linear velocity projected onto chassis forward direction (`-Z` rotated by chassis quaternion). Rotation is `-(forwardSpeed * dt / radius)` per frame (negative sign = correct visual spin direction for -Z forward).
- The `wheelRotations` ref array is reset when the vehicle controller is recreated.

### Known Issues

- **Muscle car GLB:** Wheel_1 in Blender may have incorrect rotation (0,0,0 vs 180,-90,0 for others), causing wheels 0 and 1 to report identical Z positions. Suspension/radius values in `muscle.json` are scaled up to match the larger model dimensions.

## Camera

- Inline in `Vehicle.tsx` (not a separate component).
- **Mouse orbit:** Click to capture pointer lock, Escape to release. Mouse controls azimuth/elevation around the vehicle.
- **Default position:** Behind car at +Z, looking toward -Z (azimuth=0).
- **Smoothing:** Uses `1.0 - 0.01 ** delta` for frame-rate-independent lerp.

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in JSON files, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
- All overlay UI buttons must use the `UIButton` component which prevents focus via `tabIndex={-1}` and `onMouseDown={preventDefault}`. Never use raw `<button>` in overlay UI.
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for cross-directory imports.
