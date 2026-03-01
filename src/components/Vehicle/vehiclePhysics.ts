import { MathUtils, Quaternion, Vector3 } from "three";
import type { VehicleConfig, WheelInfo } from "./vehicleConfig";
import { getGearTorque } from "./vehicleConfig";

// ---------- Types ----------

export interface Keys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
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
): EngineResult {
  const { forces, driveType, gears } = config;
  const throttle = Number(keys.forward) - Number(keys.backward);
  const steerInput = Math.abs(Number(keys.left) - Number(keys.right));
  const speedKmh = speed * 3.6;

  // FWD: reduce throttle when steering (front tires share grip between drive + turn)
  // Ramps from no penalty at standstill to full 40% at 30+ km/h
  const steerPenalty =
    driveType === "FWD"
      ? steerInput * 0.4 * MathUtils.clamp(speedKmh / 30, 0, 1)
      : 0;
  const steerThrottleReduction = 1.0 - steerPenalty;

  // Clutch engagement: ramp from 0.3 at standstill to 1.0 at ~15 km/h
  const clutchFactor = MathUtils.lerp(
    0.3,
    1.0,
    MathUtils.clamp(speedKmh / 15, 0, 1),
  );

  // Gear torque multiplier
  const gearMultiplier = gears
    ? getGearTorque(gears, speedKmh).multiplier
    : 1.0;

  const engineForce =
    throttle *
    forces.accelerate *
    steerThrottleReduction *
    clutchFactor *
    gearMultiplier;

  const handBrake = Number(keys.brake) * forces.brake;
  const handbrakeActive = handBrake > 0;
  const isReversing = throttle < 0;

  return {
    engineForce,
    throttle,
    steerInput,
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
  handbrakeActive: boolean,
  handBrake: number,
): void {
  const driveRear = driveType === "RWD" || driveType === "AWD";
  const driveFront = driveType === "FWD" || driveType === "AWD";

  // On RWD/AWD the brake and engine fight over the same rear wheels —
  // the clamped brake absorbs engine power, so rear engine force is killed.
  const rearEngineForce = driveRear && !handbrakeActive ? engineForce : 0;
  controller.setWheelEngineForce(0, rearEngineForce);
  controller.setWheelEngineForce(1, rearEngineForce);
  controller.setWheelEngineForce(2, driveFront ? engineForce : 0);
  controller.setWheelEngineForce(3, driveFront ? engineForce : 0);

  // Handbrake: locks rear wheels only (front stays free)
  controller.setWheelBrake(0, handBrake);
  controller.setWheelBrake(1, handBrake);
  controller.setWheelBrake(2, 0);
  controller.setWheelBrake(3, 0);
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
): number {
  const lowSpeedSteerBoost = MathUtils.lerp(
    1.5,
    1.0,
    MathUtils.clamp(speedKmh / 20, 0, 1),
  );
  const steerDirection = Number(keys.left) - Number(keys.right);
  const targetSteering =
    forces.steerAngle * lowSpeedSteerBoost * steerDirection;

  // Lerp toward target: 0.75 when turning in, 0.95 when centering (fast but smooth)
  const steerLerp = steerDirection === 0 ? 0.95 : 0.75;
  return MathUtils.lerp(currentSteering, targetSteering, steerLerp);
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
  speedKmh: number,
  isReversing: boolean,
  steerInput: number,
  handbrakeActive: boolean,
): WheelFrictionResult[] {
  const reverseSteering = isReversing && steerInput > 0;

  return wheels.map((wheel, i) => {
    const isFront = i >= 2;
    const isRear = i < 2;
    let sideFriction = wheel.sideFrictionStiffness;
    let frictionSlip = wheel.frictionSlip;

    // Reduce front lateral grip when reversing + steering (prevents pivot-spin)
    if (isFront && reverseSteering) sideFriction *= 0.2;

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
