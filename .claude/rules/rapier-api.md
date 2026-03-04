---
paths:
  - "src/components/Vehicle/**"
---

# DynamicRayCastVehicleController API Reference

## Initialization & Core

- `addWheel(...)`: Adds a wheel to the chassis.
- `chassis()`: Returns the underlying rigid-body.
- `updateVehicle(dt)`: Steps the simulation. Must be called in physics loop.
- `free()`: Cleans up controller memory.

## Vehicle Orientation

- `indexForwardAxis` / `setIndexForwardAxis`: Forward axis (X, Y, or Z).
- `indexUpAxis`: Upward axis.

## Dynamics & Input

- `setWheelEngineForce(i, force)`: Apply torque to wheel.
- `setWheelBrake(i, brake)`: Apply braking force.
- `setWheelSteering(i, angle)`: Turn wheel (radians).

## Suspension Tuning

- `setWheelSuspensionRestLength(i, val)`: Natural spring height.
- `setWheelSuspensionStiffness(i, val)`: Spring constant (K).
- `setWheelSuspensionCompression(i, val)`: Compression damping.
- `setWheelSuspensionRelaxation(i, val)`: Rebound damping.
- `setWheelMaxSuspensionTravel(i, val)`: Physical spring limit.
- `setWheelMaxSuspensionForce(i, val)`: Maximum spring force.

## Traction & Friction

- `setWheelFrictionSlip(i, val)`: Longitudinal grip limit.
- `setWheelSideFrictionStiffness(i, val)`: Lateral grip.

## Wheel Geometry & Placement

- `setWheelRadius(i, radius)`: Wheel size.
- `setWheelChassisConnectionPointCs(i, pos)`: Strut mount point.
- `setWheelDirectionCs(i, dir)`: Suspension direction.
- `setWheelAxleCs(i, axle)`: Wheel rotation axis.

## Telemetry

- `currentVehicleSpeed()`: Speed magnitude.
- `numWheels()`: Wheel count.
- `wheelIsInContact(i)`: Ground contact check.
- `wheelGroundObject(i)`: Contact collider.
- `wheelContactPoint(i)` / `wheelContactNormal(i)`: Tire patch data.
- `wheelSuspensionLength(i)` / `wheelSuspensionForce(i)`: Spring state.
- `wheelForwardImpulse(i)` / `wheelSideImpulse(i)`: Friction forces.
- `wheelRotation(i)`: Visual spin (broken — use manual accumulator instead).
