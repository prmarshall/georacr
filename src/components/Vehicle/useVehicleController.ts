import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import {
  type RapierRigidBody,
  useAfterPhysicsStep,
  useRapier,
} from "@react-three/rapier";
import { type RefObject, useEffect, useRef } from "react";
import { Object3D, Quaternion, Vector3 } from "three";
import type { WheelInfo } from "./vehicleConfig";

const _up = new Vector3(0, 1, 0);
const _steerQuat = new Quaternion();
const _spinQuat = new Quaternion();

export function useVehicleController(
  chassisRef: RefObject<RapierRigidBody | null>,
  wheelsRef: RefObject<(Object3D | null)[]>,
  wheels: WheelInfo[],
) {
  const { world } = useRapier();
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);

  useEffect(() => {
    const chassis = chassisRef.current;
    if (!chassis) return;

    const vehicle = world.createVehicleController(chassis);
    const suspDir = new Vector3(0, -1, 0);

    for (const [i, w] of wheels.entries()) {
      vehicle.addWheel(
        w.position,
        suspDir,
        w.axleCs,
        w.suspensionRestLength,
        w.radius,
      );
      vehicle.setWheelSuspensionStiffness(i, w.suspensionStiffness);
      vehicle.setWheelMaxSuspensionTravel(i, w.maxSuspensionTravel);
      vehicle.setWheelFrictionSlip(i, w.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(i, w.sideFrictionStiffness);
      vehicle.setWheelSuspensionCompression(i, w.suspensionCompression);
      vehicle.setWheelSuspensionRelaxation(i, w.suspensionRelaxation);
    }

    controllerRef.current = vehicle;

    return () => {
      controllerRef.current = null;
      world.removeVehicleController(vehicle);
    };
  }, [chassisRef, wheels, wheelsRef, world]);

  // Sync wheel visuals after each physics step
  useAfterPhysicsStep((w) => {
    const controller = controllerRef.current;
    const wheelObjects = wheelsRef.current;
    if (!controller || !wheelObjects) return;

    controller.updateVehicle(w.timestep);

    for (const [i, obj] of wheelObjects.entries()) {
      if (!obj) continue;

      const connection = controller.wheelChassisConnectionPointCs(i)?.y ?? 0;
      const suspension = controller.wheelSuspensionLength(i) ?? 0;
      const steering = controller.wheelSteering(i) ?? 0;
      const rotation = controller.wheelRotation(i) ?? 0;
      const axle = controller.wheelAxleCs(i);

      obj.position.y = connection - suspension;

      _steerQuat.setFromAxisAngle(_up, steering);
      if (axle) {
        _spinQuat.setFromAxisAngle(axle as unknown as Vector3, rotation);
      }
      obj.quaternion.multiplyQuaternions(_steerQuat, _spinQuat);
    }
  });

  return controllerRef;
}
