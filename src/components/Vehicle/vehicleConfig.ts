import { Vector3 } from "three";

/** Shared wheel parameters */
const wheelDefaults = {
  axleCs: new Vector3(-1, 0, 0),
  suspensionRestLength: 0.25,
  suspensionStiffness: 48,
  maxSuspensionTravel: 0.5,
  frictionSlip: 1.5,
  sideFrictionStiffness: 3,
  radius: 0.15,
  suspensionCompression: 4.4,
  suspensionRelaxation: 2.3,
};

export type WheelInfo = {
  position: Vector3;
  axleCs: Vector3;
  suspensionRestLength: number;
  suspensionStiffness: number;
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  radius: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
};

export const WHEELS: WheelInfo[] = [
  { position: new Vector3(-0.65, -0.15, 0.55), ...wheelDefaults }, // front-left
  { position: new Vector3(0.65, -0.15, 0.55), ...wheelDefaults }, // front-right
  { position: new Vector3(-0.65, -0.15, -0.55), ...wheelDefaults }, // rear-left
  { position: new Vector3(0.65, -0.15, -0.55), ...wheelDefaults }, // rear-right
];

export const VEHICLE = {
  chassisHalfExtents: [0.8, 0.2, 0.6] as [number, number, number],
  accelerateForce: 3,
  brakeForce: 1.5,
  steerAngle: Math.PI / 24,
  maxSpeed: 15,
};
