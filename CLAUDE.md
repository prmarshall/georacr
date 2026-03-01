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

## Project Structure

```
src/
├── App.tsx                              # Canvas, Physics, KeyboardControls, UI overlay
├── main.tsx                             # Entry point
├── components/
│   ├── Floor.tsx                        # 1000x1000 checkerboard ground plane
│   ├── ThirdPersonCamera.tsx            # Unused (camera is inline in Vehicle)
│   └── Vehicle/
│       ├── Vehicle.tsx                  # Main component: controls, camera, reset
│       ├── useVehicleController.ts      # Hook wrapping Rapier's DynamicRayCastVehicleController
│       └── vehicleConfig.ts            # JSON-serializable VehicleConfig type, defaults, createWheels() factory
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
- **Config:** `VehicleConfig` type in `vehicleConfig.ts` is JSON-serializable (uses `[number, number, number]` tuples, no Vector3). `DEFAULT_VEHICLE_CONFIG` provides defaults. `createWheels(config)` factory converts tuples to runtime `WheelInfo[]`. `Vehicle` accepts an optional `config` prop for variants.

## Camera

- Inline in `Vehicle.tsx` (not a separate component).
- **Grounded:** Follows behind chassis using `matrixWorld` offset.
- **Airborne:** Tracks velocity direction.
- **Smoothing:** Uses `1.0 - 0.01 ** delta` for frame-rate-independent lerp.

## Guidelines

- Use functional components with TypeScript.
- For 3D math, use Three.js classes (`Vector3`, `Quaternion`, `Euler`).
- All vehicle physics tunables go in `vehicleConfig.ts` as JSON-serializable data, not hardcoded in components.
- `useAfterPhysicsStep` for wheel visual sync; `useFrame` for controls and camera.
