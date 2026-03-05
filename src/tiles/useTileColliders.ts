import type { RapierRigidBody } from "@react-three/rapier";
import type { Object3D, Camera, WebGLRenderer } from "three";
import { useTileColliders as useColliderSync } from "3d-tiles-colliders-rapier/react";
import { useTilesCameras } from "./useTilesCameras";
import { useTilesWalls } from "./useTilesWalls";
import { useTilesDebug } from "./useTilesDebug";

export interface TilesRendererLike {
  group: Object3D;
  setCamera(camera: Camera): void;
  deleteCamera(camera: Camera): void;
  setResolutionFromRenderer(camera: Camera, renderer: WebGLRenderer): void;
}

const FRICTION = 1.5;

/**
 * Orchestrates tile collision, LOD cameras, wall colliders, and debug viz.
 * Each concern is in its own hook; this wires them together.
 *
 * IMPORTANT: All useFrame priorities across sub-hooks must be ≤ 0.
 * R3F disables auto-rendering when any subscriber has positive priority.
 */
export function useTileColliders(
  tiles: TilesRendererLike | null,
  vehicleBodyRef?: React.RefObject<RapierRigidBody | null>,
) {
  const { closeCam } = useTilesCameras(tiles, vehicleBodyRef);
  useTilesWalls(tiles);
  useTilesDebug(tiles, closeCam);

  // Collision sync — trimesh colliders from tile meshes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useColliderSync((tiles?.group ?? null) as any, { friction: FRICTION });
}
