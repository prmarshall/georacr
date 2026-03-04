import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Tiles3D } from "@/tiles/Tiles3D";
import { Physics } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vehicle } from "@/components/Vehicle/Vehicle";
import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import type { VehicleConfig } from "@/components/Vehicle/vehicleConfig";
import { VEHICLES } from "@/components/Vehicle/vehicles";

import { HUD } from "@/components/HUD";
import { MarsSky } from "@/components/MarsSky";
import { UIButton } from "@/components/UIButton";
import { DebugPanel } from "@/components/DebugPanel";
import styles from "@/App.module.scss";

const controls = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "handbrake", keys: ["Space"] },
  { name: "reset", keys: ["KeyR"] },
];

function Scene({
  vehicleRef,
  vehicleIndex,
  config,
  chassisBodyRef,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
  vehicleIndex: number;
  config: VehicleConfig;
  chassisBodyRef: React.RefObject<RapierRigidBody | null>;
}) {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <Tiles3D vehicleBodyRef={chassisBodyRef} />
      <Vehicle
        key={vehicleIndex}
        ref={vehicleRef}
        config={config}
        chassisBodyRef={chassisBodyRef}
      />
    </Physics>
  );
}

export default function App() {
  const vehicleRef = useRef<VehicleHandle>(null);
  const chassisBodyRef = useRef<RapierRigidBody>(null);
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const vehicle = VEHICLES[vehicleIndex];

  const prev = () =>
    setVehicleIndex((i) => (i - 1 + VEHICLES.length) % VEHICLES.length);
  const next = () => setVehicleIndex((i) => (i + 1) % VEHICLES.length);

  const handleReset = useCallback(() => {
    vehicleRef.current?.reset();
    setResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyR") setResetKey((k) => k + 1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.001, far: 10000 }}
        gl={{ logarithmicDepthBuffer: true }}
        className={styles.canvas}
      >
        <KeyboardControls map={controls}>
          <Scene
            vehicleRef={vehicleRef}
            vehicleIndex={vehicleIndex}
            config={vehicle.config}
            chassisBodyRef={chassisBodyRef}
          />
        </KeyboardControls>

        <directionalLight
          position={[100, 50, 100]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <ambientLight intensity={0.5} />
        <hemisphereLight intensity={0.3} />
        <MarsSky />
        <fog attach="fog" args={["#c8b898", 5, 250]} />
      </Canvas>

      <div className={styles.vehicleSelector}>
        <UIButton onClick={prev} className={styles.chevron}>
          &#8249;
        </UIButton>
        <span className={styles.vehicleName}>{vehicle.name}</span>
        <UIButton onClick={next} className={styles.chevron}>
          &#8250;
        </UIButton>
      </div>

      <HUD vehicleRef={vehicleRef} resetKey={resetKey} />

      <UIButton onClick={handleReset} className={styles.resetButton}>
        Reset (R)
      </UIButton>

      <DebugPanel />
    </>
  );
}
