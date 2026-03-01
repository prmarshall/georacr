import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import {
  type RapierRigidBody,
  useAfterPhysicsStep,
  useRapier,
} from "@react-three/rapier";
import { type RefObject, useEffect, useRef } from "react";
import { Object3D, Quaternion, Vector3 } from "three";
import type { WheelInfo } from "./vehicleConfig";

const up = new Vector3(0, 1, 0);

const _wheelSteeringQuat = new Quaternion();
const _wheelRotationQuat = new Quaternion();

export function useVehicleController(
  chassisRef: RefObject<RapierRigidBody | null>,
  wheelsRef: RefObject<(Object3D | null)[]>,
  wheelsInfo: WheelInfo[],
) {
  const { world } = useRapier();
  const vehicleController = useRef<DynamicRayCastVehicleController | null>(
    null,
  );

  useEffect(() => {
    const chassis = chassisRef.current;
    const wheels = wheelsRef.current;
    if (!chassis || !wheels || wheelsInfo.length === 0) return;

    const vehicle = world.createVehicleController(chassis);

    const suspensionDirection = new Vector3(0, -1, 0);

    for (const [index, wheel] of wheelsInfo.entries()) {
      vehicle.addWheel(
        wheel.position,
        suspensionDirection,
        wheel.axleCs,
        wheel.suspensionRestLength,
        wheel.radius,
      );
      vehicle.setWheelSuspensionStiffness(index, wheel.suspensionStiffness);
      vehicle.setWheelMaxSuspensionTravel(index, wheel.maxSuspensionTravel);
      vehicle.setWheelFrictionSlip(index, wheel.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(index, wheel.sideFrictionStiffness);
    }

    // TODO: remove debug logging
    console.log("Vehicle controller created —", wheelsInfo.length, "wheels:");
    for (const [i, w] of wheelsInfo.entries()) {
      console.log(
        `  wheel ${i}: pos(${w.position.x.toFixed(3)}, ${w.position.y.toFixed(3)}, ${w.position.z.toFixed(3)}) r=${w.radius} suspRest=${w.suspensionRestLength}`,
      );
    }

    vehicleController.current = vehicle;

    return () => {
      vehicleController.current = null;
      world.removeVehicleController(vehicle);
    };
  }, [chassisRef, wheelsInfo, wheelsRef, world]);

  useAfterPhysicsStep((world) => {
    if (!vehicleController.current) return;

    const controller = vehicleController.current;

    controller.updateVehicle(world.timestep);

    const wheels = wheelsRef.current;
    if (!wheels) return;

    for (const [index, wheel] of wheels.entries()) {
      if (!wheel) continue;

      const wheelAxleCs = controller.wheelAxleCs(index)!;
      const connection =
        controller.wheelChassisConnectionPointCs(index)?.y || 0;
      const suspension = controller.wheelSuspensionLength(index) || 0;
      const steering = controller.wheelSteering(index) || 0;
      const rotationRad = controller.wheelRotation(index) || 0;

      wheel.position.y = connection - suspension;

      _wheelSteeringQuat.setFromAxisAngle(up, steering);
      _wheelRotationQuat.setFromAxisAngle(
        wheelAxleCs as unknown as Vector3,
        rotationRad,
      );

      wheel.quaternion.multiplyQuaternions(
        _wheelSteeringQuat,
        _wheelRotationQuat,
      );
    }
  });

  return { vehicleController };
}
