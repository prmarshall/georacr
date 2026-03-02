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
│       ├── Vehicle.tsx                  # Thin orchestrator: refs, ground check, Rapier API calls, JSX
│       ├── vehiclePhysics.ts            # Pure functions: engine, drivetrain, drag, steering, yaw, friction, air control
│       ├── useChaseCamera.ts            # Chase camera hook (mouse orbit, GTA5-style follow, pointer lock)
│       ├── useVehicleController.ts      # Hook wrapping Rapier's DynamicRayCastVehicleController
│       ├── vehicleConfig.ts            # Types, parseVehicleJSON(), loadVehicleEntry(), createWheels()
│       └── vehicles.ts                 # Auto-discovers src/vehicles/*.json, exports VEHICLES
```

## Vehicle System

Based on [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

- **Controller:** Rapier's built-in `DynamicRayCastVehicleController` via `world.createVehicleController(chassis)`. Do NOT use manual raycast suspension or Hooke's Law.
- **Drive type:** Configurable per vehicle via `driveType` field (`"FWD"`, `"RWD"`, `"AWD"`, default `"FWD"`). Sedan = FWD, Sports = RWD, Tractor = RWD. Engine force applied to appropriate wheels (0,1 = rear, 2,3 = front).
- **Deceleration:** Rolling resistance (constant force when no throttle) + air drag (force proportional to speed²). Both applied via `chassisRigidBody.addForce()` — NOT `setWheelBrake`, which clamps internally and causes artificial speed caps.
- **Foot brake (S key):** Brake-then-reverse: when moving forward > 5 km/h, S applies foot brake (all 4 wheels, rear-biased 70/30 to prevent nose-dive flip). Below 5 km/h, S switches to reverse engine. Separate `brake` and `handbrake` values in JSON configs.
- **Handbrake (Space):** Realistic rear-wheel-only brake. Locks rear wheels — at low speed wheels hold firm (full friction), at 30+ km/h rear loses grip for drift/spin (friction drops to 40%). On RWD/AWD, rear engine force is killed when handbrake active (brake and engine fight over same wheels). On FWD, front wheels still drive. Uses both `setWheelFrictionSlip` and `setWheelSideFrictionStiffness` dynamically. Drift+self-centering system disabled during handbrake to prevent oscillation.
- **Brake lights:** Two red emissive rectangles at rear of chassis. Light up during foot brake or reverse, NOT during handbrake. Shared `MeshStandardMaterial` instance updated per frame.
- **Controls:** WASD + Space (handbrake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.
- **Speedometer:** `VehicleHandle.speed` (getter backed by `speedRef`) is updated each frame with chassis `linvel()` magnitude. `Speedometer` component in `App.tsx` reads it via `requestAnimationFrame` loop (no React re-renders) and displays km/h + mph. Exponential smoothing (factor 0.15) prevents flicker.
- **Stopwatch:** `Stopwatch` component in `App.tsx` starts on first accelerate key press (W/ArrowUp). Resets on R key or Reset button. Uses `performance.now()` for accurate timing.
- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/` — no code changes needed.
- **Chassis density:** Optional `chassis.density` (default 1). Rapier computes mass from collider volume \* density. When increasing density, scale forces, suspension stiffness, side friction stiffness, rolling resistance, and air drag proportionally to maintain the same driving feel.
- **Suspension damping:** Optional `suspensionDamping` on wheel defaults/placements. Applied to both Rapier's `setWheelSuspensionCompression` and `setWheelSuspensionRelaxation`. Prevents resonance tipping from rapid input changes. Scale proportionally with suspension stiffness.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` files via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime, replacing unsafe type casts and catching malformed configs early.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.
- **Steering slew rate:** Constant-rate `moveTowards` (not lerp) simulates physical steering rack. Turn-in: 2.0 rad/s (~0.26s full lock). Centering: 3.0 rad/s (self-aligning torque). Do NOT use lerp — exponential decay either feels instant or sluggish.
- **Speed-sensitive steering:** Max steer angle reduces from 100% at 30 km/h to 30% at 150+ km/h for high-speed stability. Low-speed boost (1.5x at standstill → 1.0x at 20+ km/h) still applies for tight parking turns.
- **FWD throttle reduction:** Engine force reduced up to 40% when steering on FWD vehicles. Speed-dependent: no penalty at standstill, full penalty at 30+ km/h (grip budget only matters at speed). Does not apply to RWD/AWD.
- **Reverse side friction:** Front wheel `sideFrictionStiffness` dynamically reduced to 20% when reversing + steering, preventing front wheels from anchoring and causing pivot-spin. Resets to normal immediately when going forward.
- **Yaw-rate damping:** When not steering, Y angular velocity is damped per frame. Scales with spin rate: gentle (5%) at low yaw rates, aggressive (30%) at high rates to kill post-turn spins. Do NOT use `angularDamping` on RigidBody — it damps all axes and fights intentional turns.
- **Self-centering:** When grounded, not steering, hSpeed > 15 km/h, yaw rate < 0.5, and not physically moving backward, a corrective yaw aligns heading with velocity direction (simulates caster angle). Gated by yaw rate to prevent oscillation during spins. Gate on `forwardSpeed < -1` (physical direction), NOT `isReversing` (throttle input) — prevents jitter when switching from reverse to forward at speed.
- **Steering drift:** Smoothed random yaw perturbation (target picked ~2% of frames, lerped at 5%/frame) prevents perfectly straight driving. Equalizes straight-line and post-turn top speed. Disabled during handbrake.

### Vehicle Tuning Guide

When adjusting vehicle configs, keep these relationships in mind:

- **Density scaling:** When increasing `chassis.density` by N, also scale by N: `accelerate`, `brake`, `handbrake`, `suspensionStiffness`, `sideFrictionStiffness`, `rollingResistance`, `airDragCoefficient`, `suspensionDamping`.
- **Air drag coefficient:** Determines top speed. Theoretical formula: `airDragCoefficient = totalEngineForce / targetTopSpeed²` (speed in m/s, totalEngineForce = accelerate × numDriveWheels). Applied via `addForce` on chassis, NOT `setWheelBrake`. **In practice, set ~50% lower** than the formula suggests to account for overhead from steering drift correction, angular damping, and side friction.
- **Handling (understeer/oversteer):** Controlled by `sideFrictionStiffness` (lateral grip) and `frictionSlip` (grip before sliding). Higher values = more planted. Sedan: 4/1.3, Sports: 15/1.4 (density 3), Tractor: 40/2.0 (density 10).
- **Mixed wheel sizes:** When rear and front wheels have different radii, offset the smaller wheels' Y connection point by the radius difference to keep the chassis level. E.g. tractor rear 0.65, front 0.4 → front Y lowered by 0.25.
- **Acceleration feel:** Rapier mass = collider volume \* density. F=ma gives theoretical 0-speed time. Sports car reaches 200 km/h in ~20s (accelerate 100, density 3, 5-speed gearbox).
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

- Extracted into `useChaseCamera.ts` hook — self-contained with its own `useFrame`, event listeners, and state refs.
- **Chase cam (GTA5-style):** Camera follows vehicle heading via smoothed yaw. During sharp turns (high yaw rate), camera follow speed decreases so you see the side/front of the car. When turn rate drops, camera swings back behind.
- **Mouse orbit override:** Click to capture pointer lock, Escape to release. Mouse input adds azimuth/elevation offset on top of chase cam. After 1 second of mouse idle, offsets decay back to 0 and chase cam takes over.
- **Elevation:** Base 0.35 rad, mouse adjustable. Inverted (mouse down = camera higher).
- **Default position:** Behind car at +Z, looking toward -Z.
- **Position smoothing:** Uses `1.0 - 0.01 ** delta` for frame-rate-independent lerp.
- **Yaw smoothing:** Uses `1.0 - 0.02 ** delta` (slower than position) with `sharpTurnFactor` that scales from 1.0 (straight) to 0.05 (sharp turn at yaw rate >= 3 rad/s).

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in JSON files, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
- All overlay UI buttons must use the `UIButton` component which prevents focus via `tabIndex={-1}` and `onMouseDown={preventDefault}`. Never use raw `<button>` in overlay UI.
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for cross-directory imports.
