import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import type { TilesRendererLike } from "./useTileColliders";

const CLOSE_CAM_DISTANCE = 1;
const COVERAGE_CAM_DISTANCE = 15;
const LOD_CAM_FAR = 150;

/**
 * Manages two LOD cameras that control tile Level-of-Detail loading:
 *   1. Close cam (1m behind vehicle) — forces finest LOD under car
 *   2. Coverage cam (15m behind) — fills in surrounding tiles
 *
 * The main render camera is unregistered from the tile renderer so it
 * no longer influences LOD. Both LOD cameras orbit on the flat XZ plane.
 *
 * useFrame priority: -1 (before TilesRenderer.update at priority 0)
 */
export function useTilesCameras(
  tiles: TilesRendererLike | null,
  vehicleBodyRef?: React.RefObject<RapierRigidBody | null>,
) {
  const closeCam = useRef<PerspectiveCamera | null>(null);
  const coverageCam = useRef<PerspectiveCamera | null>(null);
  const mainCam = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!tiles) return;

    // Unregister the auto-registered main camera so it no longer
    // influences LOD. It still renders whatever tiles are loaded.
    tiles.deleteCamera(mainCam);

    const close = new PerspectiveCamera(
      120,
      1,
      0.1,
      CLOSE_CAM_DISTANCE + LOD_CAM_FAR,
    );
    close.updateMatrixWorld();
    closeCam.current = close;
    tiles.setCamera(close);

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
      closeCam.current = null;
      coverageCam.current = null;
      tiles.setCamera(mainCam);
    };
  }, [tiles, mainCam]);

  // Priority -1: runs BEFORE TilesRenderer's useFrame (priority 0)
  // Both LOD cameras must be positioned before the LOD traversal.
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

      closeCam.current.position.set(
        t.x + sinA * CLOSE_CAM_DISTANCE,
        t.y,
        t.z + cosA * CLOSE_CAM_DISTANCE,
      );
      closeCam.current.lookAt(t.x, t.y, t.z);

      coverageCam.current.position.set(
        t.x + sinA * COVERAGE_CAM_DISTANCE,
        t.y,
        t.z + cosA * COVERAGE_CAM_DISTANCE,
      );
      coverageCam.current.lookAt(t.x, t.y, t.z);
    }

    closeCam.current.updateMatrixWorld();
    coverageCam.current.updateMatrixWorld();
    tiles.setResolutionFromRenderer(closeCam.current, gl);
    tiles.setResolutionFromRenderer(coverageCam.current, gl);
  }, -1);

  return { closeCam };
}
