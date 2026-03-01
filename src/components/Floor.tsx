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

function useRoadTexture() {
  return useMemo(() => {
    // One road segment: dark asphalt with a dashed center line
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    // Asphalt
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0, 0, 64, 256);
    // Edge lines (white)
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, 0, 2, 256);
    ctx.fillRect(62, 0, 2, 256);
    // Center dashed line (yellow)
    ctx.fillStyle = "#cc9900";
    ctx.fillRect(31, 0, 2, 128);
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    // Repeat along length: 1000m road, each tile covers ~4m
    tex.repeat.set(1, 250);
    tex.magFilter = NearestFilter;
    return tex;
  }, []);
}

/** 100m distance markers along the road */
function RoadMarkers() {
  const markers = [];
  for (let i = 1; i <= 10; i++) {
    const z = -i * 100;
    markers.push(
      <mesh key={i} position={[4.5, 0.02, z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color={i === 10 ? "#cc3333" : "#ffffff"} />
      </mesh>,
      <mesh
        key={`label-${i}`}
        position={[-4.5, 0.02, z]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color={i === 10 ? "#cc3333" : "#ffffff"} />
      </mesh>,
    );
  }
  return <>{markers}</>;
}

const ROAD_WIDTH = 8;
const ROAD_LENGTH = 1000;
const FLOOR_SIZE = 2200;
const FINISH_WIDTH = 12;
const FINISH_LENGTH = 4;

function useFinishTexture() {
  return useMemo(() => {
    const size = 64;
    const squares = 8;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const sq = size / squares;
    for (let row = 0; row < squares; row++) {
      for (let col = 0; col < squares; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#111111";
        ctx.fillRect(col * sq, row * sq, sq, sq);
      }
    }
    const tex = new CanvasTexture(canvas);
    tex.magFilter = NearestFilter;
    return tex;
  }, []);
}

export function Floor() {
  const checkerMap = useCheckerTexture();
  const roadMap = useRoadTexture();
  const finishMap = useFinishTexture();

  return (
    <RigidBody type="fixed" friction={1.5}>
      <CuboidCollider
        args={[FLOOR_SIZE / 2, 0.1, FLOOR_SIZE / 2]}
        position={[0, 0, -FLOOR_SIZE / 2 + 100]}
        friction={1.5}
      />
      {/* Ground */}
      <mesh receiveShadow position={[0, -0.1, -FLOOR_SIZE / 2 + 100]}>
        <boxGeometry args={[FLOOR_SIZE, 0.2, FLOOR_SIZE]} />
        <meshStandardMaterial map={checkerMap} />
      </mesh>
      {/* 1km road — starts at spawn, runs in -Z direction */}
      <mesh position={[0, 0.01, -ROAD_LENGTH / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshStandardMaterial map={roadMap} />
      </mesh>
      {/* Finish line at 1km */}
      <mesh position={[0, 0.02, -ROAD_LENGTH]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FINISH_WIDTH, FINISH_LENGTH]} />
        <meshStandardMaterial map={finishMap} />
      </mesh>
      <RoadMarkers />
    </RigidBody>
  );
}
