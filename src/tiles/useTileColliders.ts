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
  MeshStandardMaterial,
  CameraHelper,
} from "three";
import type { Collider } from "@dimforge/rapier3d-compat";
import type { RapierRigidBody } from "@react-three/rapier";
import type { Object3D, Camera, WebGLRenderer } from "three";
import { useDebugStore } from "@/stores/useDebugStore";
import { useLoadingStore } from "@/stores/useLoadingStore";

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
export function useTileColliders(
  tiles: TilesRendererLike | null,
  vehicleBodyRef?: React.RefObject<RapierRigidBody | null>,
) {
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

  // Two LOD cameras — both on the flat XZ plane, both stable:
  //   1. Coverage cam: far behind the vehicle (beyond chase camera orbit),
  //      wide frustum ensures tiles behind the viewer are loaded.
  //   2. Close cam: tight to the vehicle, forces max SSE (finest LOD)
  //      directly under and around the car for collision accuracy.
  // The tile renderer takes Math.max(SSE) across all cameras per tile,
  // so the close cam wins near the car, coverage cam wins everywhere else.
  const closeCam = useRef<PerspectiveCamera | null>(null);
  const closeCamHelper = useRef<CameraHelper | null>(null);
  const coverageCam = useRef<PerspectiveCamera | null>(null);
  const mainCam = useThree((s) => s.camera);

  const CLOSE_CAM_DISTANCE = 1; // tight behind the vehicle → max SSE over longer range
  const COVERAGE_CAM_DISTANCE = 15; // behind chase cam orbit (ORBIT_DISTANCE=12)
  const LOD_CAM_FAR = 150;

  useEffect(() => {
    if (!tiles) return;

    // Unregister the auto-registered main camera so it no longer
    // influences LOD. It still renders whatever tiles are loaded.
    tiles.deleteCamera(mainCam);

    // Close cam: tight to vehicle for max LOD under the car.
    const close = new PerspectiveCamera(
      120,
      1,
      0.1,
      CLOSE_CAM_DISTANCE + LOD_CAM_FAR,
    );
    close.updateMatrixWorld();
    closeCam.current = close;
    tiles.setCamera(close);

    // Coverage cam: far back so the viewer never sees unloaded tiles.
    const coverage = new PerspectiveCamera(
      120,
      1,
      0.1,
      COVERAGE_CAM_DISTANCE + LOD_CAM_FAR,
    );
    coverage.updateMatrixWorld();
    coverageCam.current = coverage;
    tiles.setCamera(coverage);

    return () => {
      tiles.deleteCamera(close);
      tiles.deleteCamera(coverage);
      if (closeCamHelper.current) {
        scene.remove(closeCamHelper.current);
        closeCamHelper.current.dispose();
        closeCamHelper.current = null;
      }
      closeCam.current = null;
      coverageCam.current = null;
      tiles.setCamera(mainCam);
    };
  }, [tiles, mainCam]);

  // Reactive CameraHelper: created/destroyed when toggle changes
  const showCloseCamHelper = useDebugStore((s) => s.showCloseCamHelper);
  useEffect(() => {
    if (!closeCam.current) return;
    if (showCloseCamHelper) {
      const helper = new CameraHelper(closeCam.current);
      scene.add(helper);
      closeCamHelper.current = helper;
    }
    return () => {
      if (closeCamHelper.current) {
        scene.remove(closeCamHelper.current);
        closeCamHelper.current.dispose();
        closeCamHelper.current = null;
      }
    };
  }, [showCloseCamHelper, scene]);

  // Reactive Box3Helper: created/destroyed when toggle changes
  const bboxRef = useRef<Box3 | null>(null);
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
  // which calls tiles.update(). Both LOD cameras must be current before
  // the LOD traversal happens.
  useFrame(({ camera }) => {
    if (!tiles || !closeCam.current || !coverageCam.current) return;

    const body = vehicleBodyRef?.current;
    if (body && body.isValid()) {
      const t = body.translation();

      // Viewer azimuth relative to vehicle on the flat XZ plane.
      const dx = camera.position.x - t.x;
      const dz = camera.position.z - t.z;
      const azimuth = Math.atan2(dx, dz);
      const sinA = Math.sin(azimuth);
      const cosA = Math.cos(azimuth);

      // Close cam: right behind the vehicle for max SSE.
      closeCam.current.position.set(
        t.x + sinA * CLOSE_CAM_DISTANCE,
        t.y,
        t.z + cosA * CLOSE_CAM_DISTANCE,
      );
      closeCam.current.lookAt(t.x, t.y, t.z);

      // Coverage cam: behind the chase camera orbit for full tile coverage.
      coverageCam.current.position.set(
        t.x + sinA * COVERAGE_CAM_DISTANCE,
        t.y,
        t.z + cosA * COVERAGE_CAM_DISTANCE,
      );
      coverageCam.current.lookAt(t.x, t.y, t.z);
    }

    closeCam.current.updateMatrixWorld();
    coverageCam.current.updateMatrixWorld();
    if (closeCamHelper.current) closeCamHelper.current.update();
    tiles.setResolutionFromRenderer(closeCam.current, gl);
    tiles.setResolutionFromRenderer(coverageCam.current, gl);
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
        const wireframe = useDebugStore.getState().showTileWireframe;
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          for (const m of mat)
            (m as MeshStandardMaterial).wireframe = wireframe;
        } else {
          (mat as MeshStandardMaterial).wireframe = wireframe;
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
