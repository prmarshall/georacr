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
const _forward = new Vector3();
const _linvel = new Vector3();

export function useVehicleController(
  chassisRef: RefObject<RapierRigidBody | null>,
  wheelsRef: RefObject<(Object3D | null)[]>,
  wheelsInfo: WheelInfo[],
) {
  const { world } = useRapier();
  const vehicleController = useRef<DynamicRayCastVehicleController | null>(
    null,
  );
  const wheelRotations = useRef<number[]>([]);
  const wheelContacts = useRef<boolean[]>([]);
  const wheelForwardImpulses = useRef<number[]>([]);
  const wheelSideImpulses = useRef<number[]>([]);

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
      vehicle.setWheelSuspensionCompression(index, wheel.suspensionDamping);
      vehicle.setWheelSuspensionRelaxation(index, wheel.suspensionDamping);
      vehicle.setWheelMaxSuspensionTravel(index, wheel.maxSuspensionTravel);
      vehicle.setWheelFrictionSlip(index, wheel.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(index, wheel.sideFrictionStiffness);
      vehicle.setWheelMaxSuspensionForce(index, wheel.maxSuspensionForce);
    }

    vehicleController.current = vehicle;
    wheelRotations.current = new Array(wheelsInfo.length).fill(0);
    wheelContacts.current = new Array(wheelsInfo.length).fill(false);
    wheelForwardImpulses.current = new Array(wheelsInfo.length).fill(0);
    wheelSideImpulses.current = new Array(wheelsInfo.length).fill(0);

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

    // Compute forward speed from chassis velocity directly.
    // Rapier's currentVehicleSpeed() oscillates sign during straight driving,
    // which prevents its internal wheelRotation() from accumulating.
    const chassisBody = controller.chassis();
    const linvel = chassisBody.linvel();
    const rot = chassisBody.rotation();
    _forward.set(0, 0, -1).applyQuaternion(rot as unknown as Quaternion);
    const forwardSpeed = _linvel
      .set(linvel.x, linvel.y, linvel.z)
      .dot(_forward);

    for (let i = 0; i < wheelsInfo.length; i++) {
      wheelContacts.current[i] = controller.wheelIsInContact(i);
      wheelForwardImpulses.current[i] = controller.wheelForwardImpulse(i) ?? 0;
      wheelSideImpulses.current[i] = controller.wheelSideImpulse(i) ?? 0;
    }

    for (const [index, wheel] of wheels.entries()) {
      if (!wheel) continue;

      const wheelAxleCs = controller.wheelAxleCs(index)!;
      const connection =
        controller.wheelChassisConnectionPointCs(index)?.y || 0;
      const suspension = controller.wheelSuspensionLength(index) || 0;
      const steering = controller.wheelSteering(index) || 0;

      wheel.position.y = connection - suspension;

      // Accumulate wheel spin from forward speed.
      // Positive speed (moving in -Z forward direction) produces positive
      // rotation around the X axle, which visually spins the wheel forward.
      const radius = wheelsInfo[index]?.radius || 0.15;
      wheelRotations.current[index] -= (forwardSpeed * world.timestep) / radius;

      _wheelSteeringQuat.setFromAxisAngle(up, steering);
      _wheelRotationQuat.setFromAxisAngle(
        wheelAxleCs as unknown as Vector3,
        wheelRotations.current[index],
      );

      wheel.quaternion.multiplyQuaternions(
        _wheelSteeringQuat,
        _wheelRotationQuat,
      );
    }
  });

  return {
    vehicleController,
    wheelContacts,
    wheelForwardImpulses,
    wheelSideImpulses,
  };
}
