import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import {
  Color,
  Euler,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
} from "three";
import { createWheels, type VehicleConfig } from "./vehicleConfig";
import { VEHICLES } from "./vehicles";
import { useVehicleController } from "./useVehicleController";
import { useChaseCamera } from "./useChaseCamera";
import {
  computeEngineForce,
  applyDrivetrain,
  computeDragForce,
  computeSteering,
  computeYawCorrection,
  computeWheelFriction,
  computeAirControl,
  type Keys,
  type DriftState,
} from "./vehiclePhysics";

export interface VehicleHandle {
  reset: () => void;
  /** Current speed in m/s — updated every frame, read-only. */
  speed: number;
}

interface VehicleProps {
  config?: VehicleConfig;
}

export const Vehicle = forwardRef<VehicleHandle, VehicleProps>(function Vehicle(
  { config = VEHICLES[0].config },
  ref,
) {
  const { rapier } = useRapier();
  const gl = useThree((s) => s.gl);
  const [, getKeys] = useKeyboardControls();

  // Steering drift state
  const driftState = useRef<DriftState>({ target: 0, current: 0 });

  const chassisMeshRef = useRef<Object3D>(null!);
  const chassisBodyRef = useRef<RapierRigidBody>(null!);
  const wheelsRef = useRef<(Object3D | null)[]>([]);

  const wheels = useMemo(() => createWheels(config), [config]);

  const { vehicleController, wheelContacts, wheelSuspensionForces } =
    useVehicleController(
      chassisBodyRef,
      wheelsRef as React.RefObject<(Object3D | null)[]>,
      wheels,
    );

  const speedRef = useRef(0);
  const [brakeLightMat] = useMemo(
    () => [new MeshStandardMaterial({ color: new Color("#330000") })],
    [],
  );

  const { forces, spawn, chassis, driveType } = config;

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

  // Camera runs in its own useFrame
  useChaseCamera(chassisMeshRef, vehicleController, gl);

  useFrame((_state, delta) => {
    if (!chassisMeshRef.current || !vehicleController.current) return;

    const controller = vehicleController.current;
    const chassisRigidBody = controller.chassis();
    const keys = getKeys() as unknown as Keys;

    // --- ground check (per-wheel, from previous frame's updateVehicle) ---
    const anyWheelGrounded = wheelContacts.current.some(Boolean);

    // --- engine + drivetrain ---
    const linvel = chassisRigidBody.linvel();
    const speed = Math.sqrt(
      linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z,
    );
    speedRef.current = speed;

    // Compute forward speed (velocity projected onto chassis forward direction)
    const chassisRot = chassisRigidBody.rotation();
    const fx = 2 * (chassisRot.x * chassisRot.z + chassisRot.w * chassisRot.y);
    const fz =
      1 - 2 * (chassisRot.x * chassisRot.x + chassisRot.y * chassisRot.y);
    const fLen = Math.sqrt(fx * fx + fz * fz);
    const forwardSpeed =
      fLen > 0.001 ? -(linvel.x * (fx / fLen) + linvel.z * (fz / fLen)) : 0;

    const engine = computeEngineForce(config, keys, speed, forwardSpeed);
    applyDrivetrain(
      controller,
      driveType,
      engine.engineForce,
      engine.footBrake,
      engine.handbrakeActive,
      engine.handBrake,
    );

    // --- brake lights (foot brake or reversing, NOT handbrake) ---
    const brakeLightsOn = engine.footBrake > 0 || engine.isReversing;
    if (brakeLightsOn) {
      brakeLightMat.emissive.setHex(0xff0000);
      brakeLightMat.emissiveIntensity = 2;
    } else {
      brakeLightMat.emissive.setHex(0x000000);
      brakeLightMat.emissiveIntensity = 0;
    }

    // --- air drag + rolling resistance ---
    chassisRigidBody.resetForces(true);
    const dragForce = computeDragForce(forces, speed, linvel, engine.throttle);
    if (dragForce) {
      chassisRigidBody.addForce(
        new rapier.Vector3(dragForce.x, dragForce.y, dragForce.z),
        true,
      );
    }

    // --- steering ---
    const currentSteering = controller.wheelSteering(2) || 0;
    const steering = computeSteering(
      currentSteering,
      forces,
      keys,
      engine.speedKmh,
      delta,
    );
    controller.setWheelSteering(2, steering);
    controller.setWheelSteering(3, steering);

    // --- yaw correction (drift + damping + self-centering) ---
    const hSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
    const hSpeedKmh = hSpeed * 3.6;
    const movingBackward = forwardSpeed < -1;
    if (anyWheelGrounded && !engine.handbrakeActive && !movingBackward) {
      const angvel = chassisRigidBody.angvel();
      const steerDirection = Number(keys.left) - Number(keys.right);
      const chassisRot = chassisRigidBody.rotation();

      const newAngvel = computeYawCorrection(
        linvel,
        angvel,
        chassisRot,
        steerDirection,
        hSpeedKmh,
        driftState.current,
      );
      if (newAngvel) {
        chassisRigidBody.setAngvel(
          new rapier.Vector3(newAngvel.x, newAngvel.y, newAngvel.z),
          true,
        );
      }
    } else {
      // Reset drift state when yaw correction is inactive so it starts
      // clean when re-enabled (e.g. after handbrake spin release)
      driftState.current.target = 0;
      driftState.current.current = 0;
    }

    // --- dynamic wheel friction ---
    const frictions = computeWheelFriction(
      wheels,
      driveType,
      engine.speedKmh,
      engine.throttle,
      engine.isReversing,
      engine.steerInput,
      engine.handbrakeActive,
      wheelSuspensionForces.current,
    );
    for (let i = 0; i < wheels.length; i++) {
      controller.setWheelSideFrictionStiffness(i, frictions[i].sideFriction);
      controller.setWheelFrictionSlip(i, frictions[i].frictionSlip);
    }

    // --- air control ---
    if (!anyWheelGrounded) {
      const t = 1.0 - 0.01 ** (1 / 60);
      const chassisRot = chassisRigidBody.rotation();
      const currentAngvel = chassisRigidBody.angvel();
      const newAngvel = computeAirControl(keys, chassisRot, currentAngvel, t);
      chassisRigidBody.setAngvel(
        new rapier.Vector3(newAngvel.x, newAngvel.y, newAngvel.z),
        true,
      );
    }

    // --- reset ---
    if (keys.reset) {
      doReset();
    }
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

      {/* brake lights — two small rectangles at rear of chassis, shared material */}
      <mesh
        position={[
          -chassis.halfExtents[0] * 0.6,
          -chassis.halfExtents[1] * 0.3,
          chassis.halfExtents[2] + 0.01,
        ]}
        material={brakeLightMat}
      >
        <boxGeometry args={[chassis.halfExtents[0] * 0.3, 0.08, 0.02]} />
      </mesh>
      <mesh
        position={[
          chassis.halfExtents[0] * 0.6,
          -chassis.halfExtents[1] * 0.3,
          chassis.halfExtents[2] + 0.01,
        ]}
        material={brakeLightMat}
      >
        <boxGeometry args={[chassis.halfExtents[0] * 0.3, 0.08, 0.02]} />
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
