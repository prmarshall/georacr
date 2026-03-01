import { forwardRef, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { MathUtils, Mesh, Object3D, Clock } from "three";
import { VEHICLE, WHEELS } from "./vehicleConfig";
import { useVehicleController } from "./useVehicleController";

const debugClock = new Clock();
const DEBUG_INTERVAL = 0.5; // log every 500ms

export const Vehicle = forwardRef<RapierRigidBody>(function Vehicle(_, ref) {
  const chassisRef = useRef<RapierRigidBody>(null!);
  const chassisMeshRef = useRef<Mesh>(null!);
  const wheelsRef = useRef<(Object3D | null)[]>([]);

  const vehicleController = useVehicleController(
    chassisRef,
    wheelsRef as React.RefObject<(Object3D | null)[]>,
    WHEELS,
  );

  const [, getKeys] = useKeyboardControls();

  useFrame(() => {
    const controller = vehicleController.current;
    if (!controller) return;

    const keys = getKeys() as Record<string, boolean>;

    // Engine: rear-wheel drive (wheels 2, 3) with speed limiting
    const speed = Math.abs(controller.currentVehicleSpeed());
    const speedFactor = Math.max(0, 1 - speed / VEHICLE.maxSpeed);
    const rawForce =
      Number(keys.backward ?? false) * VEHICLE.accelerateForce -
      Number(keys.forward ?? false) * VEHICLE.accelerateForce;
    const engineForce = rawForce * speedFactor;
    controller.setWheelEngineForce(2, engineForce);
    controller.setWheelEngineForce(3, engineForce);

    // Brakes: all wheels
    const brake = Number(keys.brake ?? false) * VEHICLE.brakeForce;
    for (let i = 0; i < WHEELS.length; i++) {
      controller.setWheelBrake(i, brake);
    }

    // Steering: front wheels with smoothing
    const steerDir = Number(keys.right ?? false) - Number(keys.left ?? false);
    const currentSteering = controller.wheelSteering(0) ?? 0;
    const targetSteering = VEHICLE.steerAngle * steerDir;
    const steering = MathUtils.lerp(currentSteering, targetSteering, 0.5);
    controller.setWheelSteering(0, steering);
    controller.setWheelSteering(1, steering);

    // Debounced debug log
    if (debugClock.getElapsedTime() > DEBUG_INTERVAL) {
      debugClock.start();
      const chassis = chassisRef.current;
      if (chassis) {
        const pos = chassis.translation();
        console.log(
          `pos=(${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}) speed=${speed.toFixed(1)} engine=${engineForce.toFixed(2)} steer=${steering.toFixed(2)}`,
        );
      }
    }
  });

  // Merge forwarded ref with internal ref
  const setRefs = (instance: RapierRigidBody | null) => {
    chassisRef.current = instance!;
    if (typeof ref === "function") {
      ref(instance);
    } else if (ref) {
      (ref as React.MutableRefObject<RapierRigidBody | null>).current =
        instance;
    }
  };

  return (
    <RigidBody
      ref={setRefs}
      type="dynamic"
      colliders={false}
      canSleep={false}
      position={[0, 2, 0]}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <CuboidCollider args={VEHICLE.chassisHalfExtents} />

      {/* Chassis visual */}
      <mesh ref={chassisMeshRef} castShadow>
        <boxGeometry
          args={[
            VEHICLE.chassisHalfExtents[0] * 2,
            VEHICLE.chassisHalfExtents[1] * 2,
            VEHICLE.chassisHalfExtents[2] * 2,
          ]}
        />
        <meshStandardMaterial color="#e04040" />
      </mesh>

      {WHEELS.map((wheel, i) => (
        <group
          key={i}
          ref={(el) => {
            wheelsRef.current[i] = el;
          }}
          position={wheel.position}
        >
          <group rotation-z={Math.PI / 2}>
            <mesh castShadow>
              <cylinderGeometry
                args={[wheel.radius, wheel.radius, wheel.radius * 0.6, 16]}
              />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
});
