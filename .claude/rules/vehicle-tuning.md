---
paths:
  - "src/vehicles/**"
  - "src/components/Vehicle/vehicleConfig.ts"
  - "src/components/Vehicle/vehiclePhysics.ts"
---

# Vehicle Tuning Guide

## Density Scaling

When increasing `chassis.density` by N, also scale by N: `accelerate`, `brake`, `handbrake`, `suspensionStiffness`, `sideFrictionStiffness`, `rollingResistance`, `airDragCoefficient`, `suspensionDamping`. Check `maxSuspensionForce` (default 10000) is sufficient.

## Key Relationships

- **Air drag coefficient:** Determines top speed. Formula: `airDragCoefficient = totalEngineForce / targetTopSpeed²` (speed in m/s). **In practice, set ~50% lower** to account for steering drift, angular damping, and side friction.
- **Handling:** Controlled by `sideFrictionStiffness` (spring rate) and `frictionSlip` (force cap). Sedan: 4/1.3, Sports: 15/1.4 (density 3), Tractor: 40/2.0 (density 10). **Both must be reduced together.** Rapier's lateral model: `F = stiffness × slipVel`, clamped to `frictionSlip × normalForce`.
- **Mixed wheel sizes:** Offset smaller wheels' Y connection point by the radius difference. E.g. tractor rear 0.65, front 0.4 → front Y lowered by 0.25.
- **Anti-wheelie:** Add `chassis.centerOfMassY` (negative, e.g. -0.2). Uses `setAdditionalMassProperties` phantom mass at Y=-2.0. Does NOT use `massProperties` on collider.
- **Acceleration feel:** Rapier mass = collider volume \* density. Sports car: 200 km/h in ~20s (accelerate 100, density 3, 5-speed gearbox).
- **Wheel visual width:** `radius * 0.7`. **Wheel X placement:** >= chassis halfExtent X.

## Coordinate Convention: -Z Forward

**Critical. Do NOT change to +Z forward.**

- Forward: -Z (Three.js right-handed default)
- Axle: `axleCs: [1, 0, 0]` (X axis)
- Rapier forward: `cross(axle, suspension)` = `(0, 0, -1)` = -Z
- Engine force: Positive = forward (-Z). Do NOT negate — breaks `wheelRotation()`.
- Wheel order: indices 0,1 = rear (+Z), 2,3 = front (-Z)
- Wheel visual: `rotation-z={-Math.PI / 2}` orients cylinder along X axle
- Blender: +Y forward → glTF exporter maps to -Z automatically
