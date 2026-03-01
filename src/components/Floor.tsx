import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { CanvasTexture, RepeatWrapping, NearestFilter } from "three";

function useCheckerTexture(size = 8, repeats = 250) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const half = size / 2;
    ctx.fillStyle = "#4a7c4f";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#3d6b42";
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeats, repeats);
    tex.magFilter = NearestFilter;
    return tex;
  }, [size, repeats]);
}

export function Floor() {
  const checkerMap = useCheckerTexture();

  return (
    <RigidBody type="fixed" friction={1.5}>
      <CuboidCollider args={[500, 0.1, 500]} friction={1.5} />
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[1000, 0.2, 1000]} />
        <meshStandardMaterial map={checkerMap} />
      </mesh>
    </RigidBody>
  );
}
