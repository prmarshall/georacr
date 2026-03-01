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
│   ├── sedan.json
│   ├── sports.json
│   └── tractor.json                     # Slow debug vehicle
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
- **Drive:** FWD — engine force on wheels 2, 3 (front). Wheels 0, 1 are rear.
- **Deceleration:** Rolling resistance (constant brake when no throttle) + air drag (brake proportional to speed²).
- **Controls:** WASD + Space (brake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.
- **Speedometer:** `VehicleHandle.speed` (getter backed by `speedRef`) is updated each frame with chassis `linvel()` magnitude. `Speedometer` component in `App.tsx` reads it via `requestAnimationFrame` loop (no React re-renders) and displays km/h.
- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/` — no code changes needed.
- **Chassis density:** Optional `chassis.density` (default 1). Rapier computes mass from collider volume \* density. When increasing density, scale forces, suspension stiffness, side friction stiffness, rolling resistance, and air drag proportionally to maintain the same driving feel.
- **Suspension damping:** Optional `suspensionDamping` on wheel defaults/placements. Applied to both Rapier's `setWheelSuspensionCompression` and `setWheelSuspensionRelaxation`. Prevents resonance tipping from rapid input changes. Scale proportionally with suspension stiffness.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` files via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime, replacing unsafe type casts and catching malformed configs early.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.
- **Steering response:** Lerp factor 0.75 in Vehicle.tsx. Higher = snappier turn-in, lower = more gradual.

### Vehicle Tuning Guide

When adjusting vehicle configs, keep these relationships in mind:

- **Density scaling:** When increasing `chassis.density` by N, also scale by N: `accelerate`, `brake`, `suspensionStiffness`, `sideFrictionStiffness`, `rollingResistance`, `airDragCoefficient`, `suspensionDamping`.
- **Handling (understeer/oversteer):** Controlled by `sideFrictionStiffness` (lateral grip) and `frictionSlip` (grip before sliding). Higher values = more planted. Sedan: 4/1.3, Sports: 5/1.4, Tractor: 40/2.0.
- **Mixed wheel sizes:** When rear and front wheels have different radii, offset the smaller wheels' Y connection point by the radius difference to keep the chassis level. E.g. tractor rear 0.65, front 0.4 → front Y lowered by 0.25.
- **Acceleration feel:** Rapier mass = collider volume \* density. F=ma gives theoretical 0-speed time. Sports car (mass ~7.5, force 60) → ~8 m/s² → 0-50 km/h in ~1.7s theoretical, ~2-3s with drag. Acceptable for sporty car, a true supercar would need more force.
- **Wheel visual width:** `radius * 0.7` — proportional to wheel size.
- **Wheel X placement:** Must be >= chassis halfExtent X to avoid clipping into the body.

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

## Camera

- Inline in `Vehicle.tsx` (not a separate component).
- **Mouse orbit:** Click to capture pointer lock, Escape to release. Mouse controls azimuth/elevation around the vehicle. Elevation is inverted (mouse down = camera higher).
- **Default position:** Behind car at +Z, looking toward -Z (azimuth=0).
- **Smoothing:** Uses `1.0 - 0.01 ** delta` for frame-rate-independent lerp.

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in JSON files, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
- All overlay UI buttons must use the `UIButton` component which prevents focus via `tabIndex={-1}` and `onMouseDown={preventDefault}`. Never use raw `<button>` in overlay UI.
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for cross-directory imports.
