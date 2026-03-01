import { MathUtils, Vector3 } from "three";

// --- JSON-serializable config types ---

export type Vec3Tuple = [number, number, number];

export interface WheelDefaults {
  axleCs: Vec3Tuple;
  suspensionRestLength: number;
  suspensionStiffness: number;
  suspensionDamping?: number;
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  radius: number;
}

export interface WheelPlacement extends Partial<WheelDefaults> {
  position: Vec3Tuple;
}

export type DriveType = "FWD" | "RWD" | "AWD";

export interface VehicleConfig {
  color: string;
  driveType: DriveType;
  chassis: {
    halfExtents: Vec3Tuple;
    density?: number;
  };
  forces: {
    accelerate: number;
    brake: number;
    steerAngle: number;
    rollingResistance: number;
    airDragCoefficient: number;
  };
  wheels: {
    defaults: WheelDefaults;
    placements: WheelPlacement[];
  };
  spawn: {
    position: Vec3Tuple;
    rotation: Vec3Tuple;
  };
}

// --- Runtime type (consumed by useVehicleController) ---

export interface WheelInfo {
  position: Vector3;
  axleCs: Vector3;
  suspensionRestLength: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  radius: number;
}

// --- JSON → VehicleConfig loader ---

export interface VehicleConfigJSON {
  name: string;
  color: string;
  driveType?: DriveType;
  chassis: VehicleConfig["chassis"];
  forces: Omit<VehicleConfig["forces"], "steerAngle"> & {
    steerAngleDeg: number;
  };
  wheels: VehicleConfig["wheels"];
  spawn: VehicleConfig["spawn"];
}

const REQUIRED_SECTIONS = [
  "name",
  "color",
  "chassis",
  "forces",
  "wheels",
  "spawn",
] as const;

export function parseVehicleJSON(raw: unknown): VehicleConfigJSON {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Vehicle config must be an object");
  }
  const obj = raw as Record<string, unknown>;
  for (const key of REQUIRED_SECTIONS) {
    if (!(key in obj)) {
      throw new Error(`Vehicle config missing required field "${key}"`);
    }
  }
  return raw as VehicleConfigJSON;
}

export interface VehicleEntry {
  name: string;
  config: VehicleConfig;
}

export function loadVehicleEntry(json: VehicleConfigJSON): VehicleEntry {
  const { name, driveType, forces, ...rest } = json;
  const { steerAngleDeg, ...restForces } = forces;
  return {
    name,
    config: {
      ...rest,
      driveType: driveType ?? "FWD",
      forces: {
        ...restForces,
        steerAngle: MathUtils.degToRad(steerAngleDeg),
      },
    },
  };
}

// --- Factory function ---

export function createWheels(config: VehicleConfig): WheelInfo[] {
  const { defaults, placements } = config.wheels;
  return placements.map((placement) => ({
    position: new Vector3(...placement.position),
    axleCs: new Vector3(...(placement.axleCs ?? defaults.axleCs)),
    suspensionRestLength:
      placement.suspensionRestLength ?? defaults.suspensionRestLength,
    suspensionStiffness:
      placement.suspensionStiffness ?? defaults.suspensionStiffness,
    suspensionDamping:
      placement.suspensionDamping ?? defaults.suspensionDamping ?? 0,
    maxSuspensionTravel:
      placement.maxSuspensionTravel ?? defaults.maxSuspensionTravel,
    frictionSlip: placement.frictionSlip ?? defaults.frictionSlip,
    sideFrictionStiffness:
      placement.sideFrictionStiffness ?? defaults.sideFrictionStiffness,
    radius: placement.radius ?? defaults.radius,
  }));
}
