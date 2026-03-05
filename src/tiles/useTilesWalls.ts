import { useEffect, useRef } from "react";
import { useRapier } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Box3, Box3Helper, Color } from "three";
import type { Collider } from "@dimforge/rapier3d-compat";
import type { TilesRendererLike } from "./useTileColliders";
import { useDebugStore } from "@/stores/useDebugStore";
import { useLoadingStore } from "@/stores/useLoadingStore";

const FRICTION = 1.5;

/**
 * Computes the tile group bounding box once meshes load, creates 4 invisible
 * wall colliders around the edges, and signals `tilesReady` to gate Vehicle spawn.
 *
 * useFrame priority: 0
 */
export function useTilesWalls(tiles: TilesRendererLike | null) {
  const { world, rapier } = useRapier();
  const scene = useThree((s) => s.scene);

  const worldRef = useRef(world);
  const rapierRef = useRef(rapier);
  useEffect(() => {
    worldRef.current = world;
    rapierRef.current = rapier;
  }, [world, rapier]);

  const bboxHelper = useRef<Box3Helper | null>(null);
  const wallColliders = useRef<Collider[]>([]);
  const bboxBuilt = useRef(false);
  const bboxRef = useRef<Box3 | null>(null);

  // Reactive Box3Helper: created/destroyed when toggle changes
  const showBboxHelper = useDebugStore((s) => s.showBboxHelper);
  useEffect(() => {
    if (!bboxRef.current) return;
    if (showBboxHelper) {
      const helper = new Box3Helper(bboxRef.current, new Color(0xff0000));
      scene.add(helper);
      bboxHelper.current = helper;
    }
    return () => {
      if (bboxHelper.current) {
        scene.remove(bboxHelper.current);
        bboxHelper.current = null;
      }
    };
  }, [showBboxHelper, scene]);

  // Cleanup wall colliders + helpers on unmount
  useEffect(() => {
    return () => {
      for (const c of wallColliders.current) {
        worldRef.current.removeCollider(c, true);
      }
      wallColliders.current = [];
      if (bboxHelper.current) {
        scene.remove(bboxHelper.current);
        bboxHelper.current = null;
      }
    };
  }, [scene]);

  // Build bbox + walls once meshes appear
  useFrame(() => {
    if (!tiles || bboxBuilt.current) return;
    const group = tiles.group;
    if (!group) return;

    const box = new Box3().setFromObject(group);
    if (box.isEmpty()) return;

    bboxBuilt.current = true;
    bboxRef.current = box;
    useLoadingStore.getState().setTilesReady();

    // Create helper if debug toggle is already on
    if (useDebugStore.getState().showBboxHelper) {
      const helper = new Box3Helper(box, new Color(0xff0000));
      scene.add(helper);
      bboxHelper.current = helper;
    }

    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    console.log(
      "[TileColliders] bbox center:",
      center.toArray(),
      "size:",
      size.toArray(),
    );

    // Create 4 wall colliders around the bounding box edges
    const WALL_THICK = 0.5;
    const WALL_HEIGHT = 10;
    const hx = size.x / 2;
    const hz = size.z / 2;

    const walls: [number, number, number, number, number, number][] = [
      // -X wall
      [
        WALL_THICK,
        WALL_HEIGHT,
        hz,
        center.x - hx - WALL_THICK,
        center.y + WALL_HEIGHT,
        center.z,
      ],
      // +X wall
      [
        WALL_THICK,
        WALL_HEIGHT,
        hz,
        center.x + hx + WALL_THICK,
        center.y + WALL_HEIGHT,
        center.z,
      ],
      // -Z wall
      [
        hx,
        WALL_HEIGHT,
        WALL_THICK,
        center.x,
        center.y + WALL_HEIGHT,
        center.z - hz - WALL_THICK,
      ],
      // +Z wall
      [
        hx,
        WALL_HEIGHT,
        WALL_THICK,
        center.x,
        center.y + WALL_HEIGHT,
        center.z + hz + WALL_THICK,
      ],
    ];

    for (const [whx, why, whz, wx, wy, wz] of walls) {
      const wallDesc = rapierRef.current.ColliderDesc.cuboid(whx, why, whz);
      wallDesc.setTranslation(wx, wy, wz);
      wallDesc.friction = FRICTION;
      const wallCollider = worldRef.current.createCollider(wallDesc);
      wallColliders.current.push(wallCollider);
    }
  });

  return { bboxRef };
}
