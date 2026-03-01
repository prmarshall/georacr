import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Vehicle } from "@/components/Vehicle/Vehicle";
import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import type { VehicleConfig } from "@/components/Vehicle/vehicleConfig";
import { VEHICLES } from "@/components/Vehicle/vehicles";
import { Floor } from "@/components/Floor";
import { UIButton } from "@/components/UIButton";
import styles from "@/App.module.scss";

const controls = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "brake", keys: ["Space"] },
  { name: "reset", keys: ["KeyR"] },
];

function Scene({
  vehicleRef,
  vehicleIndex,
  config,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
  vehicleIndex: number;
  config: VehicleConfig;
}) {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <Floor />
      <Vehicle key={vehicleIndex} ref={vehicleRef} config={config} />
    </Physics>
  );
}

export default function App() {
  const vehicleRef = useRef<VehicleHandle>(null);
  const [vehicleIndex, setVehicleIndex] = useState(0);

  const vehicle = VEHICLES[vehicleIndex];

  const prev = () =>
    setVehicleIndex((i) => (i - 1 + VEHICLES.length) % VEHICLES.length);
  const next = () => setVehicleIndex((i) => (i + 1) % VEHICLES.length);

  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 1000 }}
        className={styles.canvas}
      >
        <KeyboardControls map={controls}>
          <Scene
            vehicleRef={vehicleRef}
            vehicleIndex={vehicleIndex}
            config={vehicle.config}
          />
        </KeyboardControls>

        <ambientLight intensity={1} />
        <hemisphereLight intensity={0.5} />
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

      <UIButton
        onClick={() => vehicleRef.current?.reset()}
        className={styles.resetButton}
      >
        Reset (R)
      </UIButton>
    </>
  );
}
