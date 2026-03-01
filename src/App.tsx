import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vehicle } from "./components/Vehicle/Vehicle";
import { Floor } from "./components/Floor";
import { ThirdPersonCamera } from "./components/ThirdPersonCamera";

const keyMap = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "brake", keys: ["Space"] },
];

function Scene() {
  const vehicleRef = useRef<RapierRigidBody>(null);

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow />
      <Floor />
      <Vehicle ref={vehicleRef} />
      <ThirdPersonCamera targetRef={vehicleRef} />
    </Physics>
  );
}

export default function App() {
  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 1000 }}
        style={{ width: "100vw", height: "100vh" }}
      >
        <Scene />
      </Canvas>
    </KeyboardControls>
  );
}
