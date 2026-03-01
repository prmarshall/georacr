import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import type { Collider } from "@dimforge/rapier3d-compat";
import { Euler, MathUtils, Mesh, Object3D, Quaternion, Vector3 } from "three";
import {
  DEFAULT_VEHICLE_CONFIG,
  createWheels,
  type VehicleConfig,
} from "./vehicleConfig";
import { useVehicleController } from "./useVehicleController";

export interface VehicleHandle {
  reset: () => void;
}

interface VehicleProps {
  config?: VehicleConfig;
}

const cameraOffset = new Vector3(7, 3, 0);
const cameraTargetOffset = new Vector3(0, 1.5, 0);

const _bodyPosition = new Vector3();
const _airControlAngVel = new Vector3();
const _cameraPosition = new Vector3();
const _cameraTarget = new Vector3();

export const Vehicle = forwardRef<VehicleHandle, VehicleProps>(function Vehicle(
  { config = DEFAULT_VEHICLE_CONFIG },
  ref,
) {
  const { world, rapier } = useRapier();
  const threeControls = useThree((s) => s.controls);
  const [, getKeys] = useKeyboardControls();

  const chassisMeshRef = useRef<Mesh>(null!);
  const chassisBodyRef = useRef<RapierRigidBody>(null!);
  const wheelsRef = useRef<(Object3D | null)[]>([]);

  const wheels = useMemo(() => createWheels(config), [config]);

  const { vehicleController } = useVehicleController(
    chassisBodyRef,
    wheelsRef as React.RefObject<(Object3D | null)[]>,
    wheels,
  );

  const [smoothedCameraPosition] = useState(new Vector3(0, 100, -300));
  const [smoothedCameraTarget] = useState(new Vector3());

  const ground = useRef<Collider | null>(null);

  const { forces, spawn, chassis } = config;

  const doReset = () => {
    const controller = vehicleController.current;
    if (!controller) return;
    const body = controller.chassis();
    body.setTranslation(new rapier.Vector3(...spawn.position), true);
    const spawnRot = new Euler(...spawn.rotation);
    const spawnQuat = new Quaternion().setFromEuler(spawnRot);
    body.setRotation(spawnQuat, true);
    body.setLinvel(new rapier.Vector3(0, 0, 0), true);
    body.setAngvel(new rapier.Vector3(0, 0, 0), true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- doReset captures only stable refs (rapier, vehicleController)
  useImperativeHandle(ref, () => ({ reset: doReset }), []);

  useFrame((state, delta) => {
    if (
      !chassisMeshRef.current ||
      !vehicleController.current ||
      !!threeControls
    )
      return;

    const t = 1.0 - 0.01 ** delta;

    const controller = vehicleController.current;
    const chassisRigidBody = controller.chassis();
    const keys = getKeys() as Record<string, boolean>;

    // ground check
    const ray = new rapier.Ray(chassisRigidBody.translation(), {
      x: 0,
      y: -1,
      z: 0,
    });
    const raycastResult = world.castRay(
      ray,
      1,
      false,
      undefined,
      undefined,
      undefined,
      chassisRigidBody,
    );

    ground.current = null;
    if (raycastResult) {
      ground.current = raycastResult.collider;
    }

    // engine: FWD (wheels 0, 1)
    const throttle = Number(keys.forward) - Number(keys.backward);
    const engineForce = throttle * forces.accelerate;
    controller.setWheelEngineForce(0, engineForce);
    controller.setWheelEngineForce(1, engineForce);

    // brakes: handbrake + rolling resistance + air drag
    const speed = Math.abs(controller.currentVehicleSpeed());
    const handBrake = Number(keys.brake) * forces.brake;
    const rollingResistance =
      throttle === 0 && speed > 0.01 ? forces.rollingResistance : 0;
    const airDrag = forces.airDragCoefficient * speed * speed;
    const totalBrake = handBrake + rollingResistance + airDrag;
    controller.setWheelBrake(0, totalBrake);
    controller.setWheelBrake(1, totalBrake);
    controller.setWheelBrake(2, totalBrake);
    controller.setWheelBrake(3, totalBrake);

    // steering: front wheels with smoothing
    const currentSteering = controller.wheelSteering(0) || 0;
    const steerDirection = Number(keys.left) - Number(keys.right);
    const steering = MathUtils.lerp(
      currentSteering,
      forces.steerAngle * steerDirection,
      0.5,
    );
    controller.setWheelSteering(0, steering);
    controller.setWheelSteering(1, steering);

    // air control
    if (!ground.current) {
      const forwardAngVel = Number(keys.forward) - Number(keys.backward);
      const sideAngVel = Number(keys.left) - Number(keys.right);

      const angvel = _airControlAngVel.set(
        0,
        sideAngVel * t,
        forwardAngVel * t,
      );
      angvel.applyQuaternion(
        chassisRigidBody.rotation() as unknown as Quaternion,
      );
      const currentAngvel = chassisRigidBody.angvel();
      angvel.add(
        new Vector3(currentAngvel.x, currentAngvel.y, currentAngvel.z),
      );

      chassisRigidBody.setAngvel(
        new rapier.Vector3(angvel.x, angvel.y, angvel.z),
        true,
      );
    }

    // reset
    if (keys.reset) {
      doReset();
    }

    /* camera */

    const cameraPosition = _cameraPosition;

    if (ground.current) {
      cameraPosition.copy(cameraOffset);
      const bodyWorldMatrix = chassisMeshRef.current.matrixWorld;
      cameraPosition.applyMatrix4(bodyWorldMatrix);
    } else {
      const velocity = chassisRigidBody.linvel();
      cameraPosition.set(velocity.x, velocity.y, velocity.z);
      cameraPosition.normalize();
      cameraPosition.multiplyScalar(-10);
      const translation = chassisRigidBody.translation();
      cameraPosition.add(
        new Vector3(translation.x, translation.y, translation.z),
      );
    }

    cameraPosition.y = Math.max(
      cameraPosition.y,
      (vehicleController.current?.chassis().translation().y ?? 0) + 1,
    );

    smoothedCameraPosition.lerp(cameraPosition, t);
    state.camera.position.copy(smoothedCameraPosition);

    // camera target
    const bodyPosition = chassisMeshRef.current.getWorldPosition(_bodyPosition);
    const cameraTarget = _cameraTarget;
    cameraTarget.copy(bodyPosition);
    cameraTarget.add(cameraTargetOffset);
    smoothedCameraTarget.lerp(cameraTarget, t);

    state.camera.lookAt(smoothedCameraTarget);
  });

  return (
    <RigidBody
      position={spawn.position}
      rotation={spawn.rotation}
      canSleep={false}
      ref={chassisBodyRef}
      colliders={false}
      type="dynamic"
    >
      <CuboidCollider args={chassis.halfExtents} />

      {/* chassis */}
      <mesh ref={chassisMeshRef}>
        <boxGeometry
          args={[
            chassis.halfExtents[0] * 2,
            chassis.halfExtents[1] * 2,
            chassis.halfExtents[2] * 2,
          ]}
        />
        <meshStandardMaterial color="#e04040" />
      </mesh>

      {/* wheels */}
      {wheels.map((wheel, index) => (
        <group
          key={index}
          ref={(ref) => {
            wheelsRef.current[index] = ref;
          }}
          position={wheel.position}
        >
          <group rotation-x={-Math.PI / 2}>
            <mesh>
              <cylinderGeometry args={[wheel.radius, wheel.radius, 0.25, 16]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh scale={1.01}>
              <cylinderGeometry args={[wheel.radius, wheel.radius, 0.25, 6]} />
              <meshStandardMaterial color="#fff" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
});
