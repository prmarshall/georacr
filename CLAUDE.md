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
│   ├── HUD.tsx                          # HUD orchestrator (Speedometer + Stopwatch)
│   ├── HUD.module.scss                  # Styles for all HUD instruments
│   ├── Speedometer.tsx                  # mph primary + km/h secondary, ref-based updates
│   ├── Stopwatch.tsx                    # Elapsed time since first accel, contains ZeroToSixty
│   ├── ZeroToSixty.tsx                  # 0-60 mph timer, useState for conditional render
│   ├── UIButton.tsx                     # Non-focusable button (tabIndex=-1, preventDefault)
│   ├── UIButton.module.scss
│   ├── ThirdPersonCamera.tsx            # Unused (camera is inline in Vehicle)
│   └── Vehicle/
│       ├── Vehicle.tsx                  # Thin orchestrator: refs, Rapier API calls, brake lights, JSX
│       ├── vehiclePhysics.ts            # Pure functions: engine, drivetrain, drag, steering, yaw, friction, air control
│       ├── useChaseCamera.ts            # Chase camera hook (mouse orbit, GTA5-style follow, pointer lock)
│       ├── useVehicleController.ts      # Hook wrapping Rapier's DynamicRayCastVehicleController + wheel telemetry
│       ├── vehicleConfig.ts            # Types, parseVehicleJSON(), loadVehicleEntry(), createWheels()
│       └── vehicles.ts                 # Auto-discovers src/vehicles/*.json, exports VEHICLES
```

## Vehicle System

Based on [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

- **Controller:** Rapier's built-in `DynamicRayCastVehicleController` via `world.createVehicleController(chassis)`. Do NOT use manual raycast suspension or Hooke's Law.
- **Drive type:** Configurable per vehicle via `driveType` field (`"FWD"`, `"RWD"`, `"AWD"`, default `"FWD"`). Sedan = FWD, Sports = RWD, Tractor = RWD. Engine force applied to appropriate wheels (0,1 = rear, 2,3 = front).
- **Deceleration:** Rolling resistance (constant force when no throttle) + air drag (force proportional to speed²). Both applied via `chassisRigidBody.addForce()` — NOT `setWheelBrake`, which clamps internally and causes artificial speed caps. No native Rapier drag exists (`linearDamping` is v-proportional, not v²). `resetForces(true)` clears only our drag, not the controller's impulses.
- **Foot brake (S key):** Brake-then-reverse: when moving forward > 5 km/h, S applies foot brake (all 4 wheels, rear-biased 70/30 to prevent nose-dive flip). Below 5 km/h, S switches to reverse engine. Separate `brake` and `handbrake` values in JSON configs.
- **Handbrake (Space):** Realistic rear-wheel-only brake. Locks rear wheels — at low speed wheels hold firm (full friction), at 30+ km/h rear loses grip for drift/spin (friction drops to 40%). On RWD/AWD, rear engine force is killed when handbrake active (brake and engine fight over same wheels). On FWD, front wheels still drive. Uses both `setWheelFrictionSlip` and `setWheelSideFrictionStiffness` dynamically. Drift+self-centering system disabled during handbrake to prevent oscillation.
- **Brake lights:** Two red emissive rectangles at rear of chassis. Light up during foot brake or reverse, NOT during handbrake. Shared `MeshStandardMaterial` instance updated per frame.
- **Controls:** WASD + Space (handbrake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.
- **Speedometer:** `VehicleHandle.speed` (getter backed by `speedRef`) is updated each frame with chassis `linvel()` magnitude. `Speedometer` component reads it via `requestAnimationFrame` loop (ref + `textContent`, no React re-renders) and displays mph (primary, large) + km/h (secondary, smaller/dimmer). Exponential smoothing (factor 0.15) prevents flicker.
- **Stopwatch:** Starts on first accelerate key press (W/ArrowUp). Resets on R key or Reset button. Uses `performance.now()` for accurate timing. Owns `startTime` ref and passes it to child ZeroToSixty component. Uses ref + `textContent` for display (no re-renders).
- **0-60 mph timer:** `ZeroToSixty` component, child of `Stopwatch`. Monitors speed each frame via rAF, captures time once speed >= 60 mph. Uses `useState` (not ref) for captured time — renders null until triggered, then shows red text with time. Resets on `resetKey` change.
- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/` — no code changes needed.
- **Chassis density:** Optional `chassis.density` (default 1). Rapier computes mass from collider volume \* density. When increasing density, scale forces, suspension stiffness, side friction stiffness, rolling resistance, and air drag proportionally to maintain the same driving feel.
- **Center of mass shift:** Optional `chassis.centerOfMassY` (default none). Lowers the effective center of mass via `setAdditionalMassProperties` phantom mass to prevent wheelies on high-torque RWD vehicles. The value is the desired effective CoM Y offset (negative = lower, e.g. -0.2). Phantom mass is placed at Y=-2.0 internally; the additional mass is computed to achieve the target CoM with minimal total mass increase. One-time setup in a `useEffect`, not per-frame. Sports car uses -0.2 to bring CoM near the axle line (Y=-0.3).
- **Suspension damping:** Optional `suspensionDamping` on wheel defaults/placements. Applied to both Rapier's `setWheelSuspensionCompression` and `setWheelSuspensionRelaxation`. Prevents resonance tipping from rapid input changes. Scale proportionally with suspension stiffness.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` files via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime, replacing unsafe type casts and catching malformed configs early.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.
- **Steering slew rate:** Constant-rate `moveTowards` (not lerp) simulates physical steering rack. Turn-in: 2.0 rad/s (~0.26s full lock). Centering: 3.0 rad/s (self-aligning torque). Do NOT use lerp — exponential decay either feels instant or sluggish.
- **No high-speed steering reduction:** Cornering limits come from tire physics (friction circle + load sensitivity), not artificial angle caps. Low-speed boost (1.5x at standstill → 1.0x at 20+ km/h) for tight parking turns.
- **FWD throttle reduction:** Engine force reduced up to 40% when steering on FWD vehicles. Speed-dependent: no penalty at standstill, full penalty at 30+ km/h (grip budget only matters at speed). Does not apply to RWD/AWD.
- **Reverse side friction:** Front wheel `sideFrictionStiffness` dynamically reduced to 20% when reversing + steering, preventing front wheels from anchoring and causing pivot-spin. Resets to normal immediately when going forward.
- **Smooth steer input:** Both yaw correction and friction circle use `smoothSteerInput = abs(wheelAngle) / steerAngle` (normalized 0–1 from actual wheel angle) instead of binary keyboard input. Transitions smoothly via steering slew rate (~0.17s to center). Prevents jitter from instant friction/damping snap-back when steer key is released during oversteer recovery.
- **Yaw-rate damping:** Frame-rate-independent via `exp(-dampRate * delta)`. Blended with actual steering angle (`dampBlend = 1 - smoothSteerInput`): minimal damping when wheels are turned (tires handle it), full damping when centered. Scales with spin rate: dampRate 3.0 (gentle) to 20.0 (aggressive spin-killing). Do NOT use `angularDamping` on RigidBody — it damps all axes and fights intentional turns. Do NOT use per-frame multiplicative factors (e.g. `*= 0.95`) — frame-rate dependent.
- **Self-centering:** When grounded, hSpeed > 15 km/h, yaw rate < 0.5, dampBlend > 0.5, and not physically moving backward, a corrective yaw aligns heading with velocity direction (simulates caster angle). Strength scaled by `dampBlend` so it doesn't fight the driver during oversteer recovery. Gate on `forwardSpeed < -1` (physical direction), NOT `isReversing` (throttle input).
- **Steering drift:** Smoothed random yaw perturbation (target picked ~2% of frames, lerped at 5%/frame) prevents perfectly straight driving. Equalizes straight-line and post-turn top speed. Disabled during handbrake. **Drift state is zeroed when yaw correction system is inactive** (handbrake, airborne, reversing) to prevent stale bias causing involuntary turning after handbrake spins.
- **Ground detection:** Uses native `wheelIsInContact(i)` per-wheel checks via the controller (NOT a custom chassis raycast). `anyWheelGrounded` gates yaw correction; all wheels airborne gates air control.
- **Wheel telemetry:** `useVehicleController` exposes `wheelContacts`, `wheelForwardImpulses`, `wheelSideImpulses`, `wheelSuspensionForces` refs — populated each frame in `useAfterPhysicsStep`. Suspension forces feed the tire load sensitivity system; impulse data available for future wheelspin/traction HUD.
- **Max suspension force:** `setWheelMaxSuspensionForce` configured per wheel (default 10000, configurable via `maxSuspensionForce` in JSON). Prevents silent force capping on heavy vehicles.
- **No clutch factor:** Engine delivers full force at all speeds. Traction is limited naturally by `frictionSlip` — if wheel force exceeds grip, wheels spin (physically correct). No artificial low-speed throttle reduction.
- **Friction circle (traction circle):** Drive wheels under throttle + steer lose both `sideFrictionStiffness` (spring rate) AND `frictionSlip` (force cap). Reducing only the spring rate is insufficient — the tire still reaches the same max lateral force at a larger slip angle. Reducing the force cap simulates Pacejka slip curve drop-off: once required cornering force exceeds the reduced cap, the tire breaks loose (snap oversteer). `gripLoss = absThrottle * steerInput * speedOnset * maxLoss`, where maxLoss scales 0.3→0.6 with speed. Only affects drive wheels; disabled during handbrake.
- **Tire load sensitivity:** Per-wheel `sideFrictionStiffness` scaled by load ratio (`wheelSuspensionForce / avgForce`). Underloaded wheels lose grip linearly; overloaded wheels get only 20% of extra load as grip (diminishing returns). Weight transfer always reduces total axle grip — inside tire loses more than outside gains. This enables oversteer under acceleration (rear loads but can't fully capitalize on the extra weight).
- **Wheel suspension force telemetry:** `useVehicleController` exposes `wheelSuspensionForces` ref — populated each frame from `wheelSuspensionForce(i)` in `useAfterPhysicsStep`. Feeds the tire load sensitivity system.

### Vehicle Tuning Guide

When adjusting vehicle configs, keep these relationships in mind:

- **Density scaling:** When increasing `chassis.density` by N, also scale by N: `accelerate`, `brake`, `handbrake`, `suspensionStiffness`, `sideFrictionStiffness`, `rollingResistance`, `airDragCoefficient`, `suspensionDamping`. Check `maxSuspensionForce` (default 10000) is sufficient for heavy vehicles.
- **Air drag coefficient:** Determines top speed. Theoretical formula: `airDragCoefficient = totalEngineForce / targetTopSpeed²` (speed in m/s, totalEngineForce = accelerate × numDriveWheels). Applied via `addForce` on chassis, NOT `setWheelBrake`. **In practice, set ~50% lower** than the formula suggests to account for overhead from steering drift correction, angular damping, and side friction.
- **Handling (understeer/oversteer):** Controlled by `sideFrictionStiffness` (lateral grip spring rate) and `frictionSlip` (absolute force cap). Higher values = more planted. Sedan: 4/1.3, Sports: 15/1.4 (density 3), Tractor: 40/2.0 (density 10). **Both must be reduced together** for effective grip loss — reducing only `sideFrictionStiffness` still allows the same max lateral force at larger slip angles. Rapier's lateral model: `F = stiffness × slipVel`, clamped to `frictionSlip × normalForce`.
- **Mixed wheel sizes:** When rear and front wheels have different radii, offset the smaller wheels' Y connection point by the radius difference to keep the chassis level. E.g. tractor rear 0.65, front 0.4 → front Y lowered by 0.25.
- **Anti-wheelie (center of mass):** If a high-torque RWD vehicle wheelies on launch, add `chassis.centerOfMassY` (negative value, e.g. -0.2). This shifts effective CoM down near the axle line without changing collider geometry. Uses `setAdditionalMassProperties` with phantom mass at Y=-2.0; the additional mass is `originalMass * |comY| / (2.0 - |comY|)`. Total mass increase is small (~11% for comY=-0.2). Does NOT use `massProperties` on the collider (which would replace density). Sedan and tractor should not need this.
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

## HUD

- **HUD.tsx** orchestrates driving instruments (`Speedometer`, `Stopwatch`). Vehicle selector and reset button are general UI in `App.tsx`, NOT part of HUD.
- **Refs vs useState rule:** Use refs + `textContent` for values that update every frame (speedometer, stopwatch elapsed). Use `useState` for discrete events that drive conditional rendering (0-60 capture). Never read refs during render (React 19 strict mode). If a value controls `if (x === null) return null`, it must be state.

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in JSON files, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
- All overlay UI buttons must use the `UIButton` component which prevents focus via `tabIndex={-1}` and `onMouseDown={preventDefault}`. Never use raw `<button>` in overlay UI.
- Use SCSS modules (`.module.scss`) for component styles, `@/` alias for cross-directory imports.
- **Refs vs state:** Refs for high-frequency per-frame updates (60fps DOM writes via `textContent`). `useState` for one-shot discrete events that trigger re-renders (conditional rendering, showing/hiding elements).

## Reference: DynamicRayCastVehicleController (Full API)

### 1. Initialization & Core

- `constructor(...)`: Initializes the controller.
- `addWheel(...)`: Adds a wheel to the chassis.
- `chassis()`: Returns the underlying rigid-body.
- `updateVehicle(dt)`: Steps the simulation. Must be called in the physics loop.
- `free()`: Cleans up the controller memory.

### 2. Vehicle Orientation

- `indexForwardAxis` / `setIndexForwardAxis`: Gets/sets the forward axis (X, Y, or Z).
- `indexUpAxis`: Gets the upward axis of the vehicle.

### 3. Dynamics & Input (Setters)

- `setWheelEngineForce(i, force)`: Apply torque to wheel `i`.
- `setWheelBrake(i, brake)`: Apply braking force to wheel `i`.
- `setWheelSteering(i, angle)`: Turn wheel `i` (in radians).

### 4. Suspension Tuning

- `setWheelSuspensionRestLength(i, val)`: The "natural" height of the spring.
- `setWheelSuspensionStiffness(i, val)`: Spring constant (K).
- `setWheelSuspensionCompression(i, val)`: Damping when the spring is squashed.
- `setWheelSuspensionRelaxation(i, val)`: Damping when the spring rebounds.
- `setWheelMaxSuspensionTravel(i, val)`: Physical limit of spring movement.
- `setWheelMaxSuspensionForce(i, val)`: Maximum force the spring can apply.

### 5. Traction & Friction

- `setWheelFrictionSlip(i, val)`: Longitudinal grip limit.
- `setWheelSideFrictionStiffness(i, val)`: Lateral grip (higher = snappier, lower = driftier).

### 6. Wheel Geometry & Placement

- `setWheelRadius(i, radius)`: Physical size of the wheel.
- `setWheelChassisConnectionPointCs(i, pos)`: Where the strut meets the car.
- `setWheelDirectionCs(i, dir)`: Direction the suspension travels.
- `setWheelAxleCs(i, axle)`: The axis the wheel rotates around.

### 7. Real-time Telemetry (Getters)

- `currentVehicleSpeed()`: Current speed magnitude.
- `numWheels()`: Total wheel count.
- `wheelIsInContact(i)`: Boolean check for ground contact.
- `wheelGroundObject(i)`: The collider the wheel is touching.
- `wheelContactPoint(i)` / `wheelContactNormal(i)`: Physics data at the tire patch.
- `wheelSuspensionLength(i)` / `wheelSuspensionForce(i)`: Current spring state.
- `wheelForwardImpulse(i)` / `wheelSideImpulse(i)`: Friction forces being applied.
- `wheelRotation(i)`: For visual wheel spinning FX.
