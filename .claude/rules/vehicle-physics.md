---
paths:
  - "src/components/Vehicle/**"
  - "src/vehicles/**"
---

# Vehicle Physics System

Based on [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

- **Controller:** Rapier's built-in `DynamicRayCastVehicleController` via `world.createVehicleController(chassis)`. Do NOT use manual raycast suspension or Hooke's Law.
- **Drive type:** Configurable per vehicle via `driveType` field (`"FWD"`, `"RWD"`, `"AWD"`, default `"FWD"`). Sedan = FWD, Sports = RWD, Tractor = RWD. Engine force applied to appropriate wheels (0,1 = rear, 2,3 = front).
- **Deceleration:** Rolling resistance (constant force when no throttle) + air drag (force proportional to speed²). Both applied via `chassisRigidBody.addForce()` — NOT `setWheelBrake`, which clamps internally and causes artificial speed caps. No native Rapier drag exists (`linearDamping` is v-proportional, not v²). `resetForces(true)` clears only our drag, not the controller's impulses.
- **Foot brake (S key):** Brake-then-reverse: when moving forward > 5 km/h, S applies foot brake (all 4 wheels, rear-biased 70/30 to prevent nose-dive flip). Below 5 km/h, S switches to reverse engine. Separate `brake` and `handbrake` values in JSON configs.
- **Handbrake (Space):** Realistic rear-wheel-only brake. Locks rear wheels — at low speed wheels hold firm (full friction), at 30+ km/h rear loses grip for drift/spin (friction drops to 40%). On RWD/AWD, rear engine force is killed when handbrake active. On FWD, front wheels still drive. Uses both `setWheelFrictionSlip` and `setWheelSideFrictionStiffness` dynamically. Drift+self-centering system disabled during handbrake to prevent oscillation.
- **Brake lights:** Two red emissive rectangles at rear. Light up during foot brake or reverse, NOT during handbrake. Shared `MeshStandardMaterial` instance updated per frame.
- **Controls:** WASD + Space (handbrake) + R (reset). Defined in `App.tsx` via `KeyboardControls`.
- **Air Control:** When not grounded, WASD applies angular velocity for mid-air rotation.
- **Reset:** Exposed via `VehicleHandle` ref (`useImperativeHandle`). Callable from R key or UI button.

## Config & Registry

- **Config:** Each vehicle is a self-describing JSON file with `name`, `color`, and physics data using `[number, number, number]` tuples (no Vector3). Angles stored as degrees (`steerAngleDeg`), converted to radians by `loadVehicleEntry()`. To add a new vehicle: just drop a `.json` file in `src/vehicles/`.
- **Chassis density:** Optional `chassis.density` (default 1). Rapier computes mass from collider volume \* density. When increasing density, scale forces proportionally.
- **Center of mass shift:** Optional `chassis.centerOfMassY` (default none). Lowers effective CoM via `setAdditionalMassProperties` phantom mass. Sports car uses -0.2. One-time `useEffect`, not per-frame.
- **Suspension damping:** Optional `suspensionDamping` on wheel defaults/placements. Applied to both compression and relaxation. Scale proportionally with suspension stiffness.
- **Registry:** `vehicles.ts` auto-discovers all `src/vehicles/*.json` via `import.meta.glob`. Exports `VEHICLES: VehicleEntry[]`.
- **Validation:** `parseVehicleJSON(raw: unknown)` validates required fields at runtime.
- **Selector:** Chevron UI in `App.tsx` cycles through `VEHICLES`. Changing index remounts `Vehicle` via React `key`.

## Steering & Stability

- **Steering slew rate:** Constant-rate `moveTowards` (not lerp) simulates physical steering rack. Turn-in: 2.0 rad/s. Centering: 3.0 rad/s. Do NOT use lerp.
- **No high-speed steering reduction:** Cornering limits come from tire physics, not artificial angle caps. Low-speed boost (1.5x at standstill → 1.0x at 20+ km/h).
- **FWD throttle reduction:** Engine force reduced up to 40% when steering on FWD. Speed-dependent. Does not apply to RWD/AWD.
- **Reverse side friction:** Front wheel `sideFrictionStiffness` reduced to 20% when reversing + steering.
- **Smooth steer input:** `smoothSteerInput = abs(wheelAngle) / steerAngle` (normalized 0–1). Prevents jitter from instant friction/damping snap-back.
- **Yaw-rate damping:** Frame-rate-independent via `exp(-dampRate * delta)`. Blended with `dampBlend = 1 - smoothSteerInput`. Do NOT use `angularDamping` on RigidBody or per-frame multiplicative factors.
- **Self-centering:** When grounded, hSpeed > 15 km/h, yaw rate < 0.5, dampBlend > 0.5, and not physically moving backward. Gate on `forwardSpeed < -1` (physical direction), NOT `isReversing` (throttle input).
- **Steering drift:** Smoothed random yaw perturbation. Disabled during handbrake. **State zeroed when yaw correction inactive** to prevent stale bias.

## Tire Physics

- **Ground detection:** Uses native `wheelIsInContact(i)` per-wheel (NOT custom chassis raycast).
- **No clutch factor:** Engine delivers full force at all speeds. Traction limited by `frictionSlip`.
- **Friction circle:** Drive wheels under throttle + steer lose both `sideFrictionStiffness` AND `frictionSlip`. Only affects drive wheels; disabled during handbrake.
- **Tire load sensitivity:** Per-wheel `sideFrictionStiffness` scaled by load ratio. Underloaded wheels lose grip linearly; overloaded get only 20% of extra load.
- **Wheel telemetry:** `useVehicleController` exposes `wheelContacts`, `wheelForwardImpulses`, `wheelSideImpulses`, `wheelSuspensionForces` refs.
- **Max suspension force:** `setWheelMaxSuspensionForce` per wheel (default 10000, configurable via JSON).

## HUD Instruments

- **Speedometer:** `VehicleHandle.speed` getter updated each frame. Reads via rAF loop (ref + `textContent`, no re-renders). mph primary + km/h secondary. Exponential smoothing (0.15).
- **Stopwatch:** Starts on first accelerate key. Uses `performance.now()`. Ref + `textContent`.
- **0-60 mph timer:** `ZeroToSixty` component. Uses `useState` for captured time (conditional render). Resets on `resetKey` change.

## Wheel Spin (Visual Rotation)

- **Rapier's `wheelRotation()` is broken** — its `currentVehicleSpeed()` oscillates sign. Do NOT use.
- **Fix:** Manual accumulator in `useVehicleController.ts`. Rotation = `-(forwardSpeed * dt / radius)`.
- The `wheelRotations` ref array is reset when the controller is recreated.
