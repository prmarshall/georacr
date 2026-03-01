import {
  forwardRef,
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
  getGearTorque,
  type VehicleConfig,
} from "./vehicleConfig";
import { VEHICLES } from "./vehicles";
import { useVehicleController } from "./useVehicleController";

export interface VehicleHandle {
  reset: () => void;
  /** Current speed in m/s — updated every frame, read-only. */
  speed: number;
}

interface VehicleProps {
  config?: VehicleConfig;
}

const cameraTargetOffset = new Vector3(0, 1.5, 0);
const ORBIT_DISTANCE = 12;
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

  // Camera orbit state — mouse offset decays back to 0 (behind vehicle)
  const mouseAzimuthOffset = useRef(0);
  const mouseElevationOffset = useRef(0);
  const orbitElevation = useRef(0.35);
  const lastMouseMoveTime = useRef(0);
  const smoothedYaw = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      canvas.requestPointerLock();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      mouseAzimuthOffset.current -= e.movementX * MOUSE_SENSITIVITY;
      mouseElevationOffset.current += e.movementY * MOUSE_SENSITIVITY;
      lastMouseMoveTime.current = performance.now();
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

  const wheels = useMemo(() => createWheels(config), [config]);

  const { vehicleController } = useVehicleController(
    chassisBodyRef,
    wheelsRef as React.RefObject<(Object3D | null)[]>,
    wheels,
  );

  const [smoothedCameraPosition] = useState(new Vector3(0, 5, 8));
  const [smoothedCameraTarget] = useState(new Vector3());

  const ground = useRef<Collider | null>(null);

  const { forces, spawn, chassis, driveType, gears } = config;

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

  const speedRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      reset: doReset,
      get speed() {
        return speedRef.current;
      },
    }),
    [],
  );

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

    // engine force — drive type determines which wheels receive power
    const throttle = Number(keys.forward) - Number(keys.backward);
    const steerInput = Math.abs(Number(keys.left) - Number(keys.right));
    // FWD: reduce throttle when steering (front tires share grip between drive + turn)
    const steerThrottleReduction =
      driveType === "FWD" ? 1.0 - steerInput * 0.4 : 1.0;
    // Speed for torque/gear calculations
    const linvel = chassisRigidBody.linvel();
    const speed = Math.sqrt(
      linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z,
    );
    const speedKmhForGear = speed * 3.6;
    // Clutch engagement: ramp from 0.3 at standstill to 1.0 at ~15 km/h
    const clutchFactor = MathUtils.lerp(
      0.3,
      1.0,
      MathUtils.clamp(speedKmhForGear / 15, 0, 1),
    );
    // Gear torque multiplier (1st gear = highest, top gear = 1.0)
    const gearMultiplier = gears
      ? getGearTorque(gears, speedKmhForGear).multiplier
      : 1.0;
    const engineForce =
      throttle *
      forces.accelerate *
      steerThrottleReduction *
      clutchFactor *
      gearMultiplier;
    const driveRear = driveType === "RWD" || driveType === "AWD";
    const driveFront = driveType === "FWD" || driveType === "AWD";
    controller.setWheelEngineForce(0, driveRear ? engineForce : 0);
    controller.setWheelEngineForce(1, driveRear ? engineForce : 0);
    controller.setWheelEngineForce(2, driveFront ? engineForce : 0);
    controller.setWheelEngineForce(3, driveFront ? engineForce : 0);

    // brakes: handbrake + rolling resistance + air drag
    speedRef.current = speed;
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
    // At low speed, allow sharper steering (up to 1.5x) for tight manoeuvres
    const speedKmh = speed * 3.6;
    const isReversing = throttle < 0;
    const lowSpeedSteerBoost = MathUtils.lerp(
      1.5,
      1.0,
      MathUtils.clamp(speedKmh / 20, 0, 1),
    );
    const currentSteering = controller.wheelSteering(2) || 0;
    const steerDirection = Number(keys.left) - Number(keys.right);
    const steering = MathUtils.lerp(
      currentSteering,
      forces.steerAngle * lowSpeedSteerBoost * steerDirection,
      0.75,
    );
    controller.setWheelSteering(2, steering);
    controller.setWheelSteering(3, steering);

    // Dynamic side friction: reduce front wheel lateral grip when reversing + steering
    // so they can slide into a proper arc instead of anchoring and pivoting
    const reverseSteering = isReversing && steerInput > 0;
    for (let i = 0; i < wheels.length; i++) {
      const baseSideFriction = wheels[i].sideFrictionStiffness;
      const isFront = i >= 2;
      const sideFriction =
        isFront && reverseSteering ? baseSideFriction * 0.2 : baseSideFriction;
      controller.setWheelSideFrictionStiffness(i, sideFriction);
    }

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

    /* camera — chase + mouse orbit */

    const bodyPosition = chassisMeshRef.current.getWorldPosition(_bodyPosition);

    // Extract vehicle yaw from chassis quaternion
    const chassisRot = chassisRigidBody.rotation();
    const vehicleYaw = Math.atan2(
      2 * (chassisRot.w * chassisRot.y + chassisRot.x * chassisRot.z),
      1 - 2 * (chassisRot.y * chassisRot.y + chassisRot.z * chassisRot.z),
    );

    // GTA5-style chase cam: camera slows down during sharp turns,
    // then swings back behind when the turn rate drops.
    let yawDelta = vehicleYaw - smoothedYaw.current;
    // Wrap to [-PI, PI] for shortest rotation path
    yawDelta = ((yawDelta + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;

    // Yaw rate from physics angular velocity (Y axis)
    const angvel = chassisRigidBody.angvel();
    const yawRate = Math.abs(angvel.y);

    // High yaw rate → camera gives up following (low lerp)
    // Low yaw rate → camera snaps back behind (high lerp)
    const baseLerp = 1.0 - 0.02 ** delta;
    const sharpTurnFactor = MathUtils.clamp(1.0 - yawRate / 3.0, 0.05, 1.0);
    smoothedYaw.current += yawDelta * baseLerp * sharpTurnFactor;

    // Decay mouse offset back to 0 after 1s idle (camera returns behind vehicle)
    const mouseIdleMs = performance.now() - lastMouseMoveTime.current;
    if (mouseIdleMs > 1000) {
      const decayRate = 1.0 - 0.05 ** delta;
      mouseAzimuthOffset.current *= 1.0 - decayRate;
      mouseElevationOffset.current *= 1.0 - decayRate;
    }

    // Chase azimuth follows smoothed yaw (azimuth 0 = behind car at +Z)
    const azimuth = smoothedYaw.current + mouseAzimuthOffset.current;
    const elevation = MathUtils.clamp(
      orbitElevation.current + mouseElevationOffset.current,
      -0.2,
      Math.PI / 3,
    );

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
      <CuboidCollider
        args={chassis.halfExtents}
        density={chassis.density ?? 1}
      />

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
                args={[wheel.radius, wheel.radius, wheel.radius * 0.7, 16]}
              />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh scale={1.01}>
              <cylinderGeometry
                args={[wheel.radius, wheel.radius, wheel.radius * 0.7, 6]}
              />
              <meshStandardMaterial color="#fff" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
});
