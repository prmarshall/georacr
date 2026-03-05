# georacr

A browser-based 3D driving game built with React and Three.js. Drive vehicles across real-world photogrammetric terrain powered by OGC 3D Tiles.

**[Live Demo](https://prmarshall.github.io/georacr/)**

## Features

- **Multiple vehicles** -- Sedan (FWD), Sports Car (RWD), Tractor (RWD), each with distinct handling characteristics
- **Realistic vehicle physics** -- Rapier's `DynamicRayCastVehicleController` with engine force, gearbox, air drag, rolling resistance, handbrake drifting, tire load sensitivity, and friction circle model
- **3D Tiles terrain** -- Drive on real photogrammetric meshes loaded via the OGC 3D Tiles standard. Currently using NASA's Dingo Gap Mars dataset (Curiosity rover). Supports Google Photorealistic Tiles and Cesium Ion
- **Trimesh collision** -- Per-triangle physics colliders extracted from tile meshes with automatic LOD tracking, via the [3d-tiles-colliders-rapier](https://www.npmjs.com/package/3d-tiles-colliders-rapier) package
- **Vehicle-anchored LOD** -- Dual LOD camera system (close cam + coverage cam) decoupled from the viewer camera. Highest-detail tiles load under the vehicle for collision accuracy; viewer orbit does not affect LOD
- **Chase camera** -- GTA5-style follow cam with mouse orbit override and pointer lock
- **HUD** -- Speedometer (mph/km/h), stopwatch, and 0-60 mph timer
- **Drop-in vehicle configs** -- Add a JSON file to `src/vehicles/` and it's auto-discovered

## Getting Started

```bash
npm install
npm run dev
```

## Controls

| Key                    | Action                    |
| ---------------------- | ------------------------- |
| W / Arrow Up           | Accelerate                |
| S / Arrow Down         | Brake / Reverse           |
| A/D / Arrow Left/Right | Steer                     |
| Space                  | Handbrake                 |
| R                      | Reset vehicle             |
| Click                  | Mouse look (pointer lock) |
| Escape                 | Release mouse             |

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Framework | React 19 + TypeScript              |
| Bundler   | Vite                               |
| 3D Engine | Three.js + React Three Fiber (R3F) |
| Physics   | Rapier (via @react-three/rapier)   |
| 3D Tiles  | 3d-tiles-renderer (NASA-AMMOS)     |
| Colliders | 3d-tiles-colliders-rapier          |
| Helpers   | @react-three/drei                  |
| Styling   | SCSS Modules                       |

## Integrations

- **[3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS)** -- Loads and renders OGC 3D Tiles tilesets with automatic LOD, DRACO mesh decompression, and R3F bindings
- **[Rapier](https://rapier.rs/)** -- WASM physics engine providing rigid body dynamics, raycast vehicle controller, and trimesh colliders
- **[3d-tiles-colliders-rapier](https://www.npmjs.com/package/3d-tiles-colliders-rapier)** -- Extracted npm package handling per-triangle Rapier trimesh collider creation from 3D Tiles meshes, LOD swap tracking, and bounding-box wall generation
- **[NASA Dingo Gap dataset](https://github.com/NASA-AMMOS/3DTilesSampleData)** -- Mars terrain captured by the Curiosity rover, served as 3D Tiles from GitHub
- **Google Photorealistic 3D Tiles** -- Supported but currently disabled. Requires a Google Cloud API key (`VITE_MAP_TILES_API_TOKEN`)

---

## Vehicle Physics

Built on Rapier's `DynamicRayCastVehicleController`, with significant extensions for realistic driving behavior. The base implementation is inspired by [isaac-mason/sketches](https://github.com/isaac-mason/sketches/tree/main/sketches/rapier/dynamic-raycast-vehicle-controller).

### Engine and Drivetrain

- **Drive type** is configurable per vehicle (`FWD`, `RWD`, `AWD`). Engine force is applied only to the appropriate wheels (indices 0,1 = rear, 2,3 = front).
- **No clutch factor.** The engine delivers full force at all speeds. Traction is limited naturally by `frictionSlip` -- if wheel force exceeds grip, wheels spin. This is physically correct and avoids the sluggish low-speed feel that clutch simulation introduces.
- **Brake-then-reverse (S key):** When moving forward above 5 km/h, S applies foot brake (all 4 wheels, rear-biased 70/30 to prevent nose-dive flip). Below 5 km/h, S switches to reverse engine force.

### Air Drag and Top Speed

Rapier has no native v^2 drag (`linearDamping` is only v-proportional). Top speed is governed by a custom air drag force applied each frame via `chassisRigidBody.addForce()`:

- **Air drag** is proportional to speed^2: `airDragCoefficient * speed^2`, applied opposite to velocity.
- **Rolling resistance** is a constant force when no throttle is applied.
- Both forces are applied via `addForce()`, NOT `setWheelBrake()` (which clamps internally and creates artificial speed caps).
- `resetForces(true)` clears only our custom drag forces, not the controller's internal impulses.
- **Top speed formula:** `airDragCoefficient = totalEngineForce / targetTopSpeed^2` (speed in m/s). In practice, set ~50% lower than the formula suggests to account for overhead from steering drift, angular damping, and side friction.

### Steering

- **Constant-rate slew** (`moveTowards`, not lerp) simulates a physical steering rack. Turn-in: 2.0 rad/s (~0.26s to full lock). Centering: 3.0 rad/s (self-aligning torque). Lerp was rejected -- exponential decay either feels instant or sluggish.
- **Low-speed boost:** 1.5x steering angle at standstill, fading to 1.0x at 20+ km/h for tight parking turns.
- **No high-speed steering reduction.** Cornering limits come entirely from tire physics (friction circle + load sensitivity), not artificial angle caps.
- **FWD throttle reduction:** Engine force reduced up to 40% when steering on FWD vehicles (grip budget). Speed-dependent: no penalty at standstill, full penalty at 30+ km/h. Does not apply to RWD/AWD.
- **Reverse side friction:** Front wheel `sideFrictionStiffness` dynamically reduced to 20% when reversing + steering, preventing front wheels from anchoring and causing pivot-spin.

### Steering Drift (Yaw Perturbation)

A smoothed random yaw perturbation prevents perfectly straight driving:

- A new random yaw target is picked ~2% of frames, lerped toward at 5%/frame.
- This introduces micro-corrections that equalize straight-line and post-turn top speed. Without it, a perfectly aligned vehicle hits top speed faster than one that has just recovered from a turn (because the yaw correction system applies tiny counterforces).
- Disabled during handbrake.
- **Drift state is zeroed when the yaw correction system is inactive** (handbrake, airborne, reversing) to prevent stale bias causing involuntary turning after handbrake spins.

### Yaw Correction System

Three interconnected behaviors that stabilize the vehicle when the steering wheel is centered:

1. **Yaw-rate damping:** Frame-rate-independent via `exp(-dampRate * delta)`. Blended with actual steering angle (`dampBlend = 1 - smoothSteerInput`): minimal damping when wheels are turned (tires handle it), full damping when centered. Scales with spin rate: dampRate 3.0 (gentle) to 20.0 (aggressive spin-killing).
2. **Self-centering:** When grounded with speed > 15 km/h, a corrective yaw aligns heading with velocity direction (simulates caster angle). Gated on `dampBlend > 0.5` so it doesn't fight the driver during oversteer recovery.
3. **Steering drift** (see above): prevents the self-centering from producing a perfectly locked trajectory.

All three use `smoothSteerInput` (normalized 0-1 from actual wheel angle, NOT binary keyboard input) which transitions smoothly via the steering slew rate. This prevents jitter from instant friction/damping snap-back when the steer key is released during oversteer recovery.

**Important:** Do NOT use `angularDamping` on RigidBody -- it damps all axes and fights intentional turns. Do NOT use per-frame multiplicative factors (e.g. `*= 0.95`) -- they are frame-rate dependent.

### Handbrake

Realistic rear-wheel-only brake with speed-dependent behavior:

- **Low speed (< 30 km/h):** Rear wheels lock with full friction -- the car holds firm.
- **High speed (30+ km/h):** Rear friction drops to 40%, causing drift/spin.
- On **RWD/AWD**, rear engine force is killed when handbrake is active (brake and engine fight over same wheels). On **FWD**, front wheels still drive.
- Uses both `setWheelFrictionSlip` and `setWheelSideFrictionStiffness` dynamically.
- The yaw correction + self-centering system is fully disabled during handbrake to prevent oscillation.

### Friction Circle (Traction Circle)

Simulates combined slip -- drive wheels under simultaneous throttle + steer lose grip:

- Both `sideFrictionStiffness` (spring rate) AND `frictionSlip` (force cap) are reduced. Reducing only the spring rate is insufficient -- the tire still reaches the same max lateral force at a larger slip angle.
- Reducing the force cap simulates the Pacejka slip curve drop-off: once required cornering force exceeds the reduced cap, the tire breaks loose (snap oversteer).
- `gripLoss = absThrottle * steerInput * speedOnset * maxLoss`, where maxLoss scales 0.3 to 0.6 with speed.
- Only affects drive wheels. Disabled during handbrake.

### Tire Load Sensitivity

Per-wheel `sideFrictionStiffness` is dynamically scaled by load ratio (`wheelSuspensionForce / avgForce`):

- Underloaded wheels lose grip linearly.
- Overloaded wheels get only 20% of extra load as grip (diminishing returns).
- Weight transfer during cornering always reduces total axle grip -- the inside tire loses more than the outside gains.
- This enables oversteer under acceleration: the rear axle loads up but can't fully capitalize on the extra weight.

Suspension force telemetry is read from `wheelSuspensionForce(i)` each frame in `useAfterPhysicsStep`.

### Anti-Wheelie (Center of Mass Shift)

High-torque RWD vehicles can wheelie on launch because Rapier's `DynamicRayCastVehicleController` has no built-in anti-wheelie or pitch stabilization.

- `chassis.centerOfMassY` (e.g. -0.2) lowers the effective center of mass via `setAdditionalMassProperties` with a phantom mass at Y=-2.0.
- The additional mass is computed to achieve the target CoM with minimal total mass increase (~11% for comY=-0.2).
- One-time setup in a `useEffect`, not per-frame.
- Does NOT use `massProperties` on the collider (which would replace density and require manual inertia computation).

### Wheel Spin (Visual Rotation)

Rapier's `wheelRotation()` is broken for straight-line driving -- its internal `currentVehicleSpeed()` oscillates sign, causing the accumulated rotation to cancel out.

**Fix:** A manual accumulator computes forward speed from chassis linear velocity projected onto the chassis forward direction (`-Z` rotated by chassis quaternion). Rotation is `-(forwardSpeed * dt / radius)` per frame.

### Air Control

When all wheels are airborne, WASD applies angular velocity for mid-air rotation. Gated on `!anyWheelGrounded`.

---

## Vehicle Configuration

### Drop-in JSON System

Each vehicle is a self-describing JSON file in `src/vehicles/`. The registry (`vehicles.ts`) auto-discovers all `*.json` files via `import.meta.glob` -- no code changes needed to add a vehicle.

JSON files use `[number, number, number]` tuples (no Vector3). Angles are stored as degrees (`steerAngleDeg`) and converted to radians at load time by `loadVehicleEntry()`. Runtime validation (`parseVehicleJSON()`) catches malformed configs early.

### Key Config Fields

| Field                              | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `name`, `color`                    | Display name and chassis color                |
| `driveType`                        | `"FWD"`, `"RWD"`, or `"AWD"`                  |
| `chassis.halfExtents`              | Cuboid collider dimensions                    |
| `chassis.density`                  | Mass = volume \* density (default 1)          |
| `chassis.centerOfMassY`            | CoM shift for anti-wheelie (negative = lower) |
| `forces.accelerate`                | Engine force per drive wheel                  |
| `forces.brake`                     | Foot brake force                              |
| `forces.handbrake`                 | Handbrake force (rear only)                   |
| `forces.steerAngleDeg`             | Max steering angle in degrees                 |
| `forces.rollingResistance`         | Constant decel force (no throttle)            |
| `forces.airDragCoefficient`        | v^2 drag -- determines top speed              |
| `wheels.defaults`                  | Base values for radius, suspension, friction  |
| `wheels.placements`                | Per-wheel position overrides                  |
| `spawn.position`, `spawn.rotation` | Initial placement                             |

### Tuning Relationships

- **Density scaling:** When increasing `chassis.density` by N, also scale by N: `accelerate`, `brake`, `handbrake`, `suspensionStiffness`, `sideFrictionStiffness`, `rollingResistance`, `airDragCoefficient`, `suspensionDamping`.
- **Handling:** Controlled by `sideFrictionStiffness` (lateral grip spring rate) and `frictionSlip` (force cap). Both must be reduced together for effective grip loss.
- **Mixed wheel sizes:** When rear and front wheels have different radii, offset the smaller wheels' Y connection point by the radius difference to keep the chassis level.

### Current Vehicles

| Vehicle | Drive | Density | Character                        |
| ------- | ----- | ------- | -------------------------------- |
| Sedan   | FWD   | 1       | Balanced, understeers naturally  |
| Sports  | RWD   | 3       | Fast, snap oversteer under power |
| Tractor | RWD   | 10      | Slow, heavy, debug vehicle       |

---

## Vehicle-Anchored LOD System

The default 3d-tiles-renderer behavior registers the main viewer camera for LOD (level of detail) decisions. This means orbiting the camera vertically changes the distance to tiles, shifting LOD and destabilizing collision geometry. This project replaces that with a custom dual-camera system.

### The Problem

- Viewer orbits up -> camera moves further from tiles -> SSE drops -> coarser LOD loads -> collision geometry becomes rougher -> vehicle behavior changes
- The vehicle needs consistently high-detail trimesh colliders regardless of where the player is looking

### The Solution: Dual LOD Cameras

The main chase camera is **unregistered** from the tile renderer (`tiles.deleteCamera(mainCam)`). Two dedicated LOD cameras replace it:

1. **Close cam** (1 unit behind vehicle): Extremely close proximity produces the highest possible SSE for tiles under and ahead of the car. This forces the finest available LOD for collision accuracy.
2. **Coverage cam** (15 units behind vehicle): Positioned beyond the chase camera's orbit distance (12 units), ensuring tiles visible to the player are always loaded.

The tile renderer evaluates `Math.max(SSE)` across all registered cameras per tile. The close cam wins near the vehicle (finest LOD), the coverage cam fills in everything else.

### Flat-Plane Orbit

Both LOD cameras orbit the vehicle on the **flat XZ plane only**, mirroring the viewer's horizontal azimuth but ignoring elevation:

```
azimuth = atan2(viewer.x - vehicle.x, viewer.z - vehicle.z)
lodCam.position = (vehicle.x + sin(azimuth) * distance, vehicle.y, vehicle.z + cos(azimuth) * distance)
```

This means looking down from above does not move the LOD cameras further from the terrain.

### Why Not Fixed 360-Degree Cameras?

Multiple fixed cameras (e.g. 4-6 covering all directions) would multiply the SSE evaluation cost per tile during LOD traversal. The single rotating close cam points where the viewer is looking (usually the direction of travel). The coverage cam provides adequate LOD in all other directions. Edge cases (reverse, sideways physics) happen at lower speeds where coarser collision geometry is acceptable.

### SSE and Error Target

SSE (screen-space error) = `geometricError / (distance * sseDenominator)`. The `errorTarget` prop on `TilesRenderer` (set to 6, default 16) controls the refinement threshold. The close cam at 1 unit distance forces extremely high SSE, ensuring maximum LOD refinement for nearby tiles.

### Technical Details

- **Vehicle body tracking:** LOD cameras read the chassis rigid body position (`vehicleBodyRef.translation()`) each frame, not the chase camera position. A shared `chassisBodyRef` is passed from `App.tsx` through `Tiles3D` to `useTileColliders`, and separately to `Vehicle` which populates it.
- **Main camera unregistration:** The R3F `TilesRenderer` auto-registers the main camera in `useLayoutEffect`. After `deleteCamera()`, the component's per-frame `setResolutionFromRenderer(mainCam)` harmlessly returns `false` -- no re-registration occurs.
- **Frame ordering:** LOD camera updates run at `useFrame` priority `-1` (before the `TilesRenderer`'s priority `0` which calls `tiles.update()`).
- **Resolution registration:** `setResolutionFromRenderer(cam, gl)` must be called each frame for both cameras. Without it, the camera has no pixel dimensions and SSE calculation ignores it.
- **Debug:** A `CameraHelper` wireframe is attached to the close cam for frustum visualization.

---

## Tile Collision System

> The collision logic described here has been extracted into the **[3d-tiles-colliders-rapier](https://www.npmjs.com/package/3d-tiles-colliders-rapier)** npm package.

Each visible tile mesh gets a Rapier `trimesh` collider. The vehicle drives on the actual triangle geometry of the loaded tiles.

- **World-space baking:** Vertices are transformed by the full `matrixWorld` chain (including the Z-up to Y-up rotation) before creating the trimesh.
- **LOD tracking:** Every frame, the system diffs current visible meshes (by `uuid`) against a `Map<string, Collider>`. New meshes get colliders; removed meshes (from LOD swaps) have their colliders destroyed.
- **Bounding box walls:** Four invisible cuboid colliders (0.5m thick, 10m tall) around the tile bounding box prevent driving off the edge.
- **Friction:** All colliders use friction 1.5.

---

## Chase Camera

Extracted into `useChaseCamera.ts` -- self-contained with its own `useFrame`, event listeners, and state refs.

- **GTA5-style follow:** Camera follows vehicle heading via smoothed yaw. During sharp turns (high yaw rate), camera follow speed decreases so you see the side/front of the car. When turn rate drops, camera swings back behind.
- **Mouse orbit override:** Click for pointer lock, Escape to release. Mouse input adds azimuth/elevation offset. After 1 second idle, offsets decay and chase cam takes over.
- **Position smoothing:** `1.0 - 0.01 ** delta` (frame-rate-independent).
- **Yaw smoothing:** `1.0 - 0.02 ** delta` with `sharpTurnFactor` scaling from 1.0 (straight) to 0.05 (sharp turn at yaw rate >= 3 rad/s).

---

## HUD

- **Speedometer:** mph (primary) + km/h (secondary). Updated via `requestAnimationFrame` loop using ref + `textContent` (no React re-renders). Exponential smoothing (factor 0.15) prevents flicker.
- **Stopwatch:** Starts on first accelerate key press. Uses `performance.now()` for timing. Ref-based display.
- **0-60 mph timer:** Monitors speed each frame, captures time once speed >= 60 mph. Uses `useState` (not ref) for the captured time because it drives conditional rendering (null until triggered).

---

## Scene and Rendering

- **Near plane:** 0.001 (1mm). Tight near plane prevents tile bounding volumes from being clipped during low-altitude camera orbit.
- **Logarithmic depth buffer:** Required because the near/far ratio (0.001/10000 = 1:10,000,000) would destroy depth precision with a standard buffer.
- **Sky:** drei `<Sky>` with `distance={450000}` (default 1000 causes black sky when driving far from origin).
- **Fog:** Linear `["#b0d0f0", 5, 250]`, color-matched to sky horizon.

---

## Coordinate Convention

**-Z is forward** (Three.js right-handed default). This is critical and must not be changed.

- Rapier forward: `cross(axle, suspension)` = `cross((1,0,0), (0,-1,0))` = `(0, 0, -1)` = -Z
- Engine force: positive = forward (-Z). Negating breaks Rapier's `wheelRotation()`.
- Wheel order: indices 0,1 = rear (+Z), indices 2,3 = front (-Z)
- Blender +Y forward maps to -Z forward automatically via glTF export

---

## Build

```bash
npm run build    # tsc -b && vite build
npm run lint     # eslint
```
