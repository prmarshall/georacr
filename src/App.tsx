import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Vehicle } from "./components/Vehicle/Vehicle";
import type { VehicleHandle } from "./components/Vehicle/Vehicle";
import { Floor } from "./components/Floor";

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
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
}) {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <Floor />
      <Vehicle ref={vehicleRef} />
    </Physics>
  );
}

export default function App() {
  const vehicleRef = useRef<VehicleHandle>(null);

  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 1000 }}
        style={{ width: "100vw", height: "100vh" }}
      >
        <KeyboardControls map={controls}>
          <Scene vehicleRef={vehicleRef} />
        </KeyboardControls>

        <ambientLight intensity={1} />
        <hemisphereLight intensity={0.5} />
      </Canvas>

      <button
        onClick={() => vehicleRef.current?.reset()}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: "10px 20px",
          fontSize: 16,
          background: "#e04040",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Reset (R)
      </button>
    </>
  );
}
