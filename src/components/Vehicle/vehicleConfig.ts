import { Vector3 } from "three";

export type WheelInfo = {
  axleCs: Vector3;
  suspensionRestLength: number;
  suspensionStiffness: number;
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  position: Vector3;
  radius: number;
};

const wheelInfo: Omit<WheelInfo, "position"> = {
  axleCs: new Vector3(0, 0, -1),
  suspensionRestLength: 0.125,
  suspensionStiffness: 24,
  maxSuspensionTravel: 1,
  sideFrictionStiffness: 3,
  frictionSlip: 1.5,
  radius: 0.15,
};

export const WHEELS: WheelInfo[] = [
  // front
  { position: new Vector3(-0.65, -0.15, -0.45), ...wheelInfo },
  { position: new Vector3(-0.65, -0.15, 0.45), ...wheelInfo },
  // rear
  { position: new Vector3(0.65, -0.15, -0.45), ...wheelInfo },
  { position: new Vector3(0.65, -0.15, 0.45), ...wheelInfo },
];

export const VEHICLE = {
  chassisHalfExtents: [0.8, 0.2, 0.4] as [number, number, number],
  accelerateForce: 3,
  brakeForce: 0.05,
  steerAngle: Math.PI / 24,
  // Deceleration forces
  rollingResistance: 0.003, // constant brake when no throttle (tire deformation + drivetrain friction)
  airDragCoefficient: 0.0005, // drag proportional to speed² (aerodynamic resistance)
};

export const SPAWN = {
  position: [0, 2, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
};
