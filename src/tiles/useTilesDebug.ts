import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  CameraHelper,
} from "three";
import type { TilesRendererLike } from "./useTileColliders";
import { useDebugStore } from "@/stores/useDebugStore";

/**
 * Debug visualization for tiles: wireframe toggle, close-cam frustum helper.
 *
 * useFrame priority: 0 (MUST stay ≤ 0 — positive priority disables R3F auto-render)
 */
export function useTilesDebug(
  tiles: TilesRendererLike | null,
  closeCam: React.RefObject<PerspectiveCamera | null>,
) {
  const scene = useThree((s) => s.scene);
  const closeCamHelper = useRef<CameraHelper | null>(null);

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
  }, [showCloseCamHelper, scene, closeCam]);

  // Per-frame: update camera helper + wireframe toggle
  useFrame(() => {
    if (closeCamHelper.current) closeCamHelper.current.update();

    if (!tiles) return;
    const group = tiles.group;
    if (!group) return;

    const wireframe = useDebugStore.getState().showTileWireframe;
    group.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mat = (child as Mesh).material;
        if (Array.isArray(mat)) {
          for (const m of mat)
            (m as MeshStandardMaterial).wireframe = wireframe;
        } else {
          (mat as MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  });
}
