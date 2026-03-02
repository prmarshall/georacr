import { MathUtils, Quaternion, Vector3 } from "three";
import type { VehicleConfig, WheelInfo } from "./vehicleConfig";
import { getGearTorque } from "./vehicleConfig";

// ---------- Types ----------

export interface Keys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  reset: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface EngineResult {
  engineForce: number;
  throttle: number;
  steerInput: number;
  footBrake: number;
  handbrakeActive: boolean;
  handBrake: number;
  speedKmh: number;
  isReversing: boolean;
}

export interface DriftState {
  target: number;
  current: number;
}

// ---------- Engine / Drivetrain ----------

export function computeEngineForce(
  config: VehicleConfig,
  keys: Keys,
  speed: number,
  forwardSpeed: number,
): EngineResult {
  const { forces, driveType, gears } = config;
  const steerInput = Math.abs(Number(keys.left) - Number(keys.right));
  const speedKmh = speed * 3.6;
  const forwardSpeedKmh = forwardSpeed * 3.6;

  // Brake-then-reverse: backward key acts as foot brake when moving forward
  // above 5 km/h, switches to reverse engine below that threshold.
  let throttle: number;
  let footBrake = 0;
  if (keys.backward && forwardSpeedKmh > 5) {
    // Moving forward at speed — apply foot brake, no engine
    throttle = 0;
    footBrake = forces.brake;
  } else {
    throttle = Number(keys.forward) - Number(keys.backward);
  }

  // FWD: reduce throttle when steering (front tires share grip between drive + turn)
  // Ramps from no penalty at standstill to full 40% at 30+ km/h
  const steerPenalty =
    driveType === "FWD"
      ? steerInput * 0.4 * MathUtils.clamp(speedKmh / 30, 0, 1)
      : 0;
  const steerThrottleReduction = 1.0 - steerPenalty;

  // Gear torque multiplier
  const gearMultiplier = gears
    ? getGearTorque(gears, speedKmh).multiplier
    : 1.0;

  const engineForce =
    throttle * forces.accelerate * steerThrottleReduction * gearMultiplier;

  const handBrake = Number(keys.handbrake) * forces.handbrake;
  const handbrakeActive = handBrake > 0;
  const isReversing = throttle < 0;

  return {
    engineForce,
    throttle,
    steerInput,
    footBrake,
    handbrakeActive,
    handBrake,
    speedKmh,
    isReversing,
  };
}

export function applyDrivetrain(
  controller: {
    setWheelEngineForce(index: number, force: number): void;
    setWheelBrake(index: number, brake: number): void;
  },
  driveType: VehicleConfig["driveType"],
  engineForce: number,
  footBrake: number,
  handbrakeActive: boolean,
  handBrake: number,
): void {
  const driveRear = driveType === "RWD" || driveType === "AWD";
  const driveFront = driveType === "FWD" || driveType === "AWD";

  // Foot brake zeroes engine — no engine force when braking
  const effectiveEngine = footBrake > 0 ? 0 : engineForce;

  // On RWD/AWD the handbrake and engine fight over the same rear wheels —
  // the clamped brake absorbs engine power, so rear engine force is killed.
  const rearEngineForce = driveRear && !handbrakeActive ? effectiveEngine : 0;
  controller.setWheelEngineForce(0, rearEngineForce);
  controller.setWheelEngineForce(1, rearEngineForce);
  controller.setWheelEngineForce(2, driveFront ? effectiveEngine : 0);
  controller.setWheelEngineForce(3, driveFront ? effectiveEngine : 0);

  // Foot brake: rear-biased (70/30) to prevent nose-dive pitch flip.
  // Front wheels get reduced braking to avoid pitching the car forward,
  // especially on light vehicles with soft suspension (sedan).
  // Handbrake: rear only. Use whichever is stronger on rear wheels.
  const rearBrake = Math.max(footBrake, handBrake);
  controller.setWheelBrake(0, rearBrake);
  controller.setWheelBrake(1, rearBrake);
  controller.setWheelBrake(2, footBrake * 0.3);
  controller.setWheelBrake(3, footBrake * 0.3);
}

// ---------- Drag ----------

export function computeDragForce(
  forces: VehicleConfig["forces"],
  speed: number,
  linvel: Vec3,
  throttle: number,
): Vec3 | null {
  if (speed <= 0.01) return null;

  const dragMagnitude = forces.airDragCoefficient * speed * speed;
  const resistMagnitude = throttle === 0 ? forces.rollingResistance : 0;
  const totalResist = dragMagnitude + resistMagnitude;

  const hSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
  if (hSpeed <= 0.01) return null;

  const factor = -totalResist / hSpeed;
  return { x: linvel.x * factor, y: 0, z: linvel.z * factor };
}

// ---------- Steering ----------

export function computeSteering(
  currentSteering: number,
  forces: VehicleConfig["forces"],
  keys: Keys,
  speedKmh: number,
  delta: number,
): number {
  // Low-speed boost for tight manoeuvres (1.5x at standstill → 1.0x at 20+ km/h)
  const lowSpeedBoost = MathUtils.lerp(
    1.5,
    1.0,
    MathUtils.clamp(speedKmh / 20, 0, 1),
  );
  const maxAngle = forces.steerAngle * lowSpeedBoost;

  const steerDirection = Number(keys.left) - Number(keys.right);
  const targetSteering = maxAngle * steerDirection;

  // Slew rate: constant steering speed (rad/s) simulates physical steering rack.
  // Centering is faster (self-aligning torque from caster angle).
  const steerSpeed = steerDirection === 0 ? 3.0 : 2.0;
  const maxChange = steerSpeed * delta;

  // moveTowards: clamp change per frame to max steering speed
  const diff = targetSteering - currentSteering;
  if (Math.abs(diff) <= maxChange) return targetSteering;
  return currentSteering + Math.sign(diff) * maxChange;
}

// ---------- Yaw Correction ----------

export function computeYawCorrection(
  linvel: Vec3,
  angvel: Vec3,
  chassisRotation: { x: number; y: number; z: number; w: number },
  steerDirection: number,
  hSpeedKmh: number,
  drift: DriftState,
): Vec3 | null {
  // Only active when grounded, moving, and not handbraking
  // (caller gates on ground.current && !handbrakeActive)
  if (hSpeedKmh <= 15) return null;

  // Smoothly wander toward a new random drift target
  if (Math.random() < 0.02) {
    drift.target = (Math.random() - 0.5) * 0.006 * (hSpeedKmh / 100);
  }
  drift.current += (drift.target - drift.current) * 0.05;
  const driftVal = drift.current;

  if (steerDirection === 0) {
    const yawRate = Math.abs(angvel.y);
    // Aggressive damping for spins, gentle for normal driving
    const dampFactor = MathUtils.lerp(
      0.95,
      0.7,
      MathUtils.clamp(yawRate / 3, 0, 1),
    );
    let newYaw = angvel.y * dampFactor + driftVal;

    // Self-centering only when yaw rate is low (not during spins —
    // atan2 is unstable at high spin rates and correction oscillates)
    if (yawRate < 0.5) {
      const rot = chassisRotation;
      const fx = 2 * (rot.x * rot.z + rot.w * rot.y);
      const fz = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
      const headingYaw = Math.atan2(-fx, -fz);
      const velocityYaw = Math.atan2(linvel.x, linvel.z);
      let yawError = headingYaw - velocityYaw;
      yawError = ((yawError + Math.PI) % (2 * Math.PI)) - Math.PI;
      if (yawError < -Math.PI) yawError += 2 * Math.PI;
      newYaw += yawError * 2.0;
    }

    return { x: angvel.x, y: newYaw, z: angvel.z };
  } else {
    return { x: angvel.x, y: angvel.y + driftVal, z: angvel.z };
  }
}

// ---------- Wheel Friction ----------

export interface WheelFrictionResult {
  sideFriction: number;
  frictionSlip: number;
}

export function computeWheelFriction(
  wheels: WheelInfo[],
  driveType: VehicleConfig["driveType"],
  speedKmh: number,
  throttle: number,
  isReversing: boolean,
  steerInput: number,
  handbrakeActive: boolean,
  suspensionForces: number[],
): WheelFrictionResult[] {
  const reverseSteering = isReversing && steerInput > 0;
  const driveRear = driveType === "RWD" || driveType === "AWD";
  const driveFront = driveType === "FWD" || driveType === "AWD";

  // Load-dependent grip: wheels with less suspension load get less lateral grip.
  // During cornering, inside wheels unload → lose grip → car rotates.
  // Compute average load as baseline, then scale each wheel's grip by its
  // load ratio. This naturally simulates weight transfer from the suspension.
  let avgForce = 0;
  for (let i = 0; i < suspensionForces.length; i++) {
    avgForce += suspensionForces[i];
  }
  avgForce = avgForce / (suspensionForces.length || 1);

  return wheels.map((wheel, i) => {
    const isFront = i >= 2;
    const isRear = i < 2;

    // Tire load sensitivity: grip does NOT scale linearly with load.
    // Underloaded wheels lose grip proportionally, but overloaded wheels
    // get diminishing returns — the grip coefficient decreases at high loads.
    // This means weight transfer always reduces total axle grip, making
    // the car more dynamic in corners (inside loses more than outside gains).
    const rawRatio = avgForce > 0.01 ? suspensionForces[i] / avgForce : 1.0;
    const loadRatio =
      rawRatio <= 1.0
        ? MathUtils.clamp(rawRatio, 0.1, 1.0)
        : 1.0 + (rawRatio - 1.0) * 0.2; // 80% diminishing returns above nominal
    let sideFriction = wheel.sideFrictionStiffness * loadRatio;
    let frictionSlip = wheel.frictionSlip;

    // Reduce front lateral grip when reversing + steering (prevents pivot-spin)
    if (isFront && reverseSteering) sideFriction *= 0.2;

    // Friction circle: drive wheels under throttle lose additional lateral grip.
    // Longitudinal force (drive) competes with lateral force (cornering).
    // Full throttle + turn = drive wheels break loose.
    // Reduces BOTH sideFriction (spring rate) AND frictionSlip (force cap).
    // Without reducing frictionSlip, the tire reaches the same max lateral force
    // at a slightly larger slip angle — it never "lets go." Reducing the cap
    // simulates the drop-off past peak slip angle in real tire curves (Pacejka).
    const isDriveWheel = (isRear && driveRear) || (isFront && driveFront);
    if (isDriveWheel && !handbrakeActive) {
      const absThrottle = Math.abs(throttle);
      const speedOnset = MathUtils.clamp(speedKmh / 30, 0, 1);
      const maxLoss = MathUtils.lerp(
        0.3,
        0.6,
        MathUtils.clamp(speedKmh / 100, 0, 1),
      );
      const gripLoss = absThrottle * steerInput * speedOnset * maxLoss;
      sideFriction *= 1.0 - gripLoss;
      frictionSlip *= 1.0 - gripLoss;
    }

    // Handbrake: at speed, locked rear wheels lose grip and slide.
    // At low speed, wheels lock in place (full friction retained).
    // Floor at 40% to prevent uncontrollable spins (especially FWD).
    if (isRear && handbrakeActive) {
      const driftFactor = MathUtils.clamp(speedKmh / 30, 0, 1);
      sideFriction *= MathUtils.lerp(1.0, 0.4, driftFactor);
      frictionSlip *= MathUtils.lerp(1.0, 0.4, driftFactor);
    }

    return { sideFriction, frictionSlip };
  });
}

// ---------- Air Control ----------

const _airControlAngVel = new Vector3();

export function computeAirControl(
  keys: Keys,
  chassisRotation: { x: number; y: number; z: number; w: number },
  currentAngvel: Vec3,
  t: number,
): Vec3 {
  const forwardAngVel = Number(keys.forward) - Number(keys.backward);
  const sideAngVel = Number(keys.left) - Number(keys.right);

  const angvel = _airControlAngVel.set(forwardAngVel * t, sideAngVel * t, 0);
  angvel.applyQuaternion(chassisRotation as unknown as Quaternion);
  angvel.add(new Vector3(currentAngvel.x, currentAngvel.y, currentAngvel.z));

  return { x: angvel.x, y: angvel.y, z: angvel.z };
}
