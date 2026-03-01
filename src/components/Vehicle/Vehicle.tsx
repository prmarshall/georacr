import {
  forwardRef,
  useCallback,
  useEffect,
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
import { Euler, MathUtils, Object3D, Quaternion, Vector3 } from "three";
import {
  createWheels,
  createWheelsFromPositions,
  type VehicleConfig,
} from "./vehicleConfig";
import { VEHICLES } from "./vehicles";
import { useVehicleController } from "./useVehicleController";
import { VehicleModel } from "./VehicleModel";

export interface VehicleHandle {
  reset: () => void;
}

interface VehicleProps {
  config?: VehicleConfig;
}

const cameraTargetOffset = new Vector3(0, 1.5, 0);
const ORBIT_DISTANCE = 8;
const MOUSE_SENSITIVITY = 0.003;

const _bodyPosition = new Vector3();
const _airControlAngVel = new Vector3();
const _cameraPosition = new Vector3();
const _cameraTarget = new Vector3();

export const Vehicle = forwardRef<VehicleHandle, VehicleProps>(function Vehicle(
  { config = VEHICLES[0].config },
  ref,
) {
  const { world, rapier } = useRapier();
  const gl = useThree((s) => s.gl);
  const [, getKeys] = useKeyboardControls();

  // Mouse orbit state
  const orbitAzimuth = useRef(0); // behind car (+Z direction, car faces -Z)
  const orbitElevation = useRef(0.35);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      canvas.requestPointerLock();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      orbitAzimuth.current -= e.movementX * MOUSE_SENSITIVITY;
      orbitElevation.current = MathUtils.clamp(
        orbitElevation.current - e.movementY * MOUSE_SENSITIVITY,
        -0.2, // slight below horizon
        Math.PI / 3, // 60° above
      );
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gl]);

  const chassisMeshRef = useRef<Object3D>(null!);
  const chassisBodyRef = useRef<RapierRigidBody>(null!);
  const wheelsRef = useRef<(Object3D | null)[]>([]);

  const [modelWheelPositions, setModelWheelPositions] = useState<
    Vector3[] | null
  >(null);

  const handleWheelPositions = useCallback(
    (positions: Vector3[]) => setModelWheelPositions(positions),
    [],
  );

  // For model vehicles, wait for the model to report wheel positions before
  // creating any wheels — avoids creating a throwaway vehicle controller with
  // wrong positions that gets immediately destroyed and recreated.
  const wheels = useMemo(() => {
    if (config.model && !modelWheelPositions) return [];
    return modelWheelPositions
      ? createWheelsFromPositions(modelWheelPositions, config)
      : createWheels(config);
  }, [config, modelWheelPositions]);

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
    if (!chassisMeshRef.current || !vehicleController.current) return;

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

    // engine: FWD (wheels 2, 3 = front)
    const throttle = Number(keys.forward) - Number(keys.backward);
    const engineForce = throttle * forces.accelerate;
    controller.setWheelEngineForce(2, engineForce);
    controller.setWheelEngineForce(3, engineForce);

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

    // steering: front wheels (2, 3) with smoothing
    const currentSteering = controller.wheelSteering(2) || 0;
    const steerDirection = Number(keys.left) - Number(keys.right);
    const steering = MathUtils.lerp(
      currentSteering,
      forces.steerAngle * steerDirection,
      0.5,
    );
    controller.setWheelSteering(2, steering);
    controller.setWheelSteering(3, steering);

    // air control
    if (!ground.current) {
      const forwardAngVel = Number(keys.forward) - Number(keys.backward);
      const sideAngVel = Number(keys.left) - Number(keys.right);

      const angvel = _airControlAngVel.set(
        forwardAngVel * t,
        sideAngVel * t,
        0,
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

    /* camera — mouse orbit */

    const bodyPosition = chassisMeshRef.current.getWorldPosition(_bodyPosition);

    const azimuth = orbitAzimuth.current;
    const elevation = orbitElevation.current;

    const cameraPosition = _cameraPosition;
    cameraPosition.set(
      Math.cos(elevation) * Math.sin(azimuth) * ORBIT_DISTANCE,
      Math.sin(elevation) * ORBIT_DISTANCE + 1.5,
      Math.cos(elevation) * Math.cos(azimuth) * ORBIT_DISTANCE,
    );
    cameraPosition.add(bodyPosition);

    cameraPosition.y = Math.max(
      cameraPosition.y,
      (vehicleController.current?.chassis().translation().y ?? 0) + 0.5,
    );

    smoothedCameraPosition.lerp(cameraPosition, t);
    state.camera.position.copy(smoothedCameraPosition);

    // camera target
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

      {config.model ? (
        <VehicleModel
          ref={chassisMeshRef}
          url={config.model}
          wheelsRef={wheelsRef as React.RefObject<(Object3D | null)[]>}
          onWheelPositions={handleWheelPositions}
        />
      ) : (
        <>
          {/* chassis */}
          <mesh ref={chassisMeshRef}>
            <boxGeometry
              args={[
                chassis.halfExtents[0] * 2,
                chassis.halfExtents[1] * 2,
                chassis.halfExtents[2] * 2,
              ]}
            />
            <meshStandardMaterial color={config.color} />
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
              <group rotation-z={-Math.PI / 2}>
                <mesh>
                  <cylinderGeometry
                    args={[wheel.radius, wheel.radius, 0.25, 16]}
                  />
                  <meshStandardMaterial color="#222" />
                </mesh>
                <mesh scale={1.01}>
                  <cylinderGeometry
                    args={[wheel.radius, wheel.radius, 0.25, 6]}
                  />
                  <meshStandardMaterial color="#fff" wireframe />
                </mesh>
              </group>
            </group>
          ))}
        </>
      )}
    </RigidBody>
  );
});
