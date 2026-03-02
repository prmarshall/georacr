import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls, Sky } from "@react-three/drei";
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
  { name: "handbrake", keys: ["Space"] },
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

function Speedometer({
  vehicleRef,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
}) {
  const kmhRef = useRef<HTMLSpanElement>(null);
  const mphRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;
    let smoothedKmh = 0;
    const update = () => {
      if (kmhRef.current && mphRef.current && vehicleRef.current) {
        const rawKmh = vehicleRef.current.speed * 3.6;
        smoothedKmh += (rawKmh - smoothedKmh) * 0.15;
        kmhRef.current.textContent = `${Math.round(smoothedKmh)}`;
        mphRef.current.textContent = `${Math.round(smoothedKmh * 0.621371)}`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [vehicleRef]);

  return (
    <div className={styles.speedometer}>
      <span ref={kmhRef} className={styles.speedValue}>
        0
      </span>
      <span className={styles.speedUnit}>km/h</span>
      <span ref={mphRef} className={styles.speedValue}>
        0
      </span>
      <span className={styles.speedUnit}>mph</span>
    </div>
  );
}

function Stopwatch({ resetKey }: { resetKey: number }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    if (spanRef.current) spanRef.current.textContent = "0.00";
  }, [resetKey]);

  useEffect(() => {
    const accelKeys = new Set(["ArrowUp", "KeyW"]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (startTime.current === null && accelKeys.has(e.code)) {
        startTime.current = performance.now();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resetKey]);

  useEffect(() => {
    let raf: number;
    const update = () => {
      if (spanRef.current && startTime.current !== null) {
        const elapsed = (performance.now() - startTime.current) / 1000;
        spanRef.current.textContent = elapsed.toFixed(2);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [resetKey]);

  return (
    <div className={styles.stopwatch}>
      <span ref={spanRef}>0.00</span>
      <span className={styles.speedUnit}> s</span>
    </div>
  );
}

export default function App() {
  const vehicleRef = useRef<VehicleHandle>(null);
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
        camera={{ fov: 60, near: 0.1, far: 10000 }}
        className={styles.canvas}
      >
        <KeyboardControls map={controls}>
          <Scene
            vehicleRef={vehicleRef}
            vehicleIndex={vehicleIndex}
            config={vehicle.config}
          />
        </KeyboardControls>

        <Sky sunPosition={[100, 50, 100]} />
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

      <Speedometer vehicleRef={vehicleRef} />
      <Stopwatch resetKey={resetKey} />

      <UIButton onClick={handleReset} className={styles.resetButton}>
        Reset (R)
      </UIButton>
    </>
  );
}
