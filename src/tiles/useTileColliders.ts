import { useEffect, useRef } from "react";
import { useRapier } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Mesh,
  Vector3,
  Box3,
  Box3Helper,
  Color,
  PerspectiveCamera,
} from "three";
import type { Collider } from "@dimforge/rapier3d-compat";
import type { Object3D, Camera, WebGLRenderer } from "three";

export interface TilesRendererLike {
  group: Object3D;
  setCamera(camera: Camera): void;
  deleteCamera(camera: Camera): void;
  setResolutionFromRenderer(camera: Camera, renderer: WebGLRenderer): void;
}

const FRICTION = 1.5;
const _v = new Vector3();

/**
 * Creates Rapier trimesh colliders from visible 3D tile meshes.
 * Tracks tile LOD swaps — adds colliders for new meshes, removes
 * colliders for meshes that have been unloaded.
 */
export function useTileColliders(tiles: TilesRendererLike | null) {
  const { world, rapier } = useRapier();
  const scene = useThree((s) => s.scene);

  const worldRef = useRef(world);
  const rapierRef = useRef(rapier);
  worldRef.current = world;
  rapierRef.current = rapier;

  // Map mesh uuid → collider for tracking LOD changes
  const colliderMap = useRef<Map<string, Collider>>(new Map());

  // Bounding box debug + wall colliders
  const bboxHelper = useRef<Box3Helper | null>(null);
  const wallColliders = useRef<Collider[]>([]);
  const bboxBuilt = useRef(false);

  // Vehicle LOD camera — forces high-res tiles near the car
  const vehicleCam = useRef<PerspectiveCamera | null>(null);

  // Register a second vehicle camera to force high-res LOD near the car.
  // The main R3F camera stays registered (by TilesRenderer component) for
  // frustum culling / visibility. The tile renderer picks the highest LOD
  // requirement across all registered cameras.
  useEffect(() => {
    if (!tiles) return;

    // 90° FOV from 5m above the car — covers ~10m diameter on the ground,
    // close enough to force high-res LOD for tiles the car is driving on.
    const cam = new PerspectiveCamera(90, 1, 0.1, 200);
    cam.position.set(0, 5, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    vehicleCam.current = cam;

    tiles.setCamera(cam);
    return () => {
      tiles.deleteCamera(cam);
      vehicleCam.current = null;
    };
  }, [tiles]);

  // Cleanup all colliders on unmount
  useEffect(() => {
    return () => {
      for (const collider of colliderMap.current.values()) {
        worldRef.current.removeCollider(collider, true);
      }
      colliderMap.current.clear();
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

  const gl = useThree((s) => s.gl);

  // Priority -1: runs BEFORE the TilesRenderer's useFrame (priority 0)
  // which calls tiles.update(). The vehicle camera position and resolution
  // must be current before the LOD traversal happens.
  useFrame(({ camera }) => {
    if (!tiles || !vehicleCam.current) return;

    vehicleCam.current.position.set(
      camera.position.x,
      camera.position.y + 5,
      camera.position.z,
    );
    vehicleCam.current.lookAt(
      camera.position.x,
      camera.position.y,
      camera.position.z,
    );
    vehicleCam.current.updateMatrixWorld();
    tiles.setResolutionFromRenderer(vehicleCam.current, gl);
  }, -1);

  // Priority 0 (default): runs after tiles.update() so meshes are current
  useFrame(() => {
    if (!tiles) return;

    const group = tiles.group;
    if (!group) return;

    // Collect current visible mesh uuids
    const currentMeshes = new Map<string, Mesh>();
    group.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        // Debug: wireframe
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          for (const m of mat) m.wireframe = true;
        } else {
          mat.wireframe = true;
        }
        currentMeshes.set(mesh.uuid, mesh);
      }
    });

    // Remove colliders for meshes that are no longer visible
    for (const [uuid, collider] of colliderMap.current) {
      if (!currentMeshes.has(uuid)) {
        worldRef.current.removeCollider(collider, true);
        colliderMap.current.delete(uuid);
      }
    }

    // Add colliders for new meshes
    for (const [uuid, mesh] of currentMeshes) {
      if (colliderMap.current.has(uuid)) continue;

      const geo = mesh.geometry;
      if (!geo) continue;

      const posAttr = geo.getAttribute("position");
      if (!posAttr) continue;

      // Bake world matrix into vertices (includes the Z-up → Y-up rotation)
      mesh.updateWorldMatrix(true, false);
      const worldMatrix = mesh.matrixWorld;

      const vertices = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        _v.fromBufferAttribute(posAttr, i);
        _v.applyMatrix4(worldMatrix);
        vertices[i * 3] = _v.x;
        vertices[i * 3 + 1] = _v.y;
        vertices[i * 3 + 2] = _v.z;
      }

      // Build index array
      let indices: Uint32Array;
      if (geo.index) {
        indices = new Uint32Array(geo.index.array);
      } else {
        // Non-indexed: sequential triangles
        indices = new Uint32Array(posAttr.count);
        for (let i = 0; i < posAttr.count; i++) indices[i] = i;
      }

      const desc = rapierRef.current.ColliderDesc.trimesh(vertices, indices);
      if (!desc) continue;
      desc.friction = FRICTION;

      const collider = worldRef.current.createCollider(desc);
      colliderMap.current.set(uuid, collider);
    }

    // Build bounding box helper + invisible wall colliders once meshes are loaded
    if (!bboxBuilt.current && currentMeshes.size > 0) {
      const box = new Box3().setFromObject(group);
      if (!box.isEmpty()) {
        bboxBuilt.current = true;

        // Debug viz
        const helper = new Box3Helper(box, new Color(0xff0000));
        scene.add(helper);
        bboxHelper.current = helper;

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
        // Walls are thin cuboids along each edge, tall enough to stop the car
        const WALL_THICK = 0.5;
        const WALL_HEIGHT = 10;
        const hx = size.x / 2;
        const hz = size.z / 2;

        const walls: [number, number, number, number, number, number][] = [
          // [halfExtX, halfExtY, halfExtZ, posX, posY, posZ]
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
      }
    }
  });
}
