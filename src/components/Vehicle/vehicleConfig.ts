import { Vector3 } from "three";

// --- JSON-serializable config types ---

export type Vec3Tuple = [number, number, number];

export interface WheelDefaults {
  axleCs: Vec3Tuple;
  suspensionRestLength: number;
  suspensionStiffness: number;
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  radius: number;
}

export interface WheelPlacement extends Partial<WheelDefaults> {
  position: Vec3Tuple;
}

export interface VehicleConfig {
  chassis: {
    halfExtents: Vec3Tuple;
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
  maxSuspensionTravel: number;
  frictionSlip: number;
  sideFrictionStiffness: number;
  radius: number;
}

// --- Default config ---

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  chassis: {
    halfExtents: [0.8, 0.2, 0.4],
  },
  forces: {
    accelerate: 3,
    brake: 0.05,
    steerAngle: Math.PI / 24,
    rollingResistance: 0.003,
    airDragCoefficient: 0.0005,
  },
  wheels: {
    defaults: {
      axleCs: [0, 0, -1],
      suspensionRestLength: 0.125,
      suspensionStiffness: 24,
      maxSuspensionTravel: 1,
      sideFrictionStiffness: 3,
      frictionSlip: 1.5,
      radius: 0.15,
    },
    placements: [
      // front
      { position: [-0.65, -0.15, -0.45] },
      { position: [-0.65, -0.15, 0.45] },
      // rear
      { position: [0.65, -0.15, -0.45] },
      { position: [0.65, -0.15, 0.45] },
    ],
  },
  spawn: {
    position: [0, 2, 0],
    rotation: [0, 0, 0],
  },
};

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
    maxSuspensionTravel:
      placement.maxSuspensionTravel ?? defaults.maxSuspensionTravel,
    frictionSlip: placement.frictionSlip ?? defaults.frictionSlip,
    sideFrictionStiffness:
      placement.sideFrictionStiffness ?? defaults.sideFrictionStiffness,
    radius: placement.radius ?? defaults.radius,
  }));
}
