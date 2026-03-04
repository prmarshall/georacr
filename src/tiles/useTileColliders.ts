import { useEffect, useRef } from "react";
import { useRapier } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { Raycaster, Vector3 } from "three";
import type { Collider } from "@dimforge/rapier3d-compat";
import type { Object3D } from "three";

/**
 * Interface for the TilesRenderer instance — we only need raycasting +
 * access to the group so we can call intersectObject().
 */
export interface TilesRendererLike {
  group: Object3D;
}

/** Half-size of the ground collider box. */
const GROUND_HALF = 50;
/** How far above the car to start the raycast. */
const RAY_ORIGIN_OFFSET = 200;
/** Maximum ray distance. */
const RAY_MAX = 500;
/** Friction to apply to ground collider. */
const FRICTION = 1.5;
/** How many raycasts to perform per check (center + surrounding grid). */
const RAY_GRID_SIZE = 3; // 3×3 = 9 rays
const RAY_SPACING = 15; // meters between grid rays

// Reusable objects
const _raycaster = new Raycaster();
const _down = new Vector3(0, -1, 0);
const _origin = new Vector3();

/**
 * Casts rays downward from the car into the 3D tile scene using Three.js
 * raycasting (which uses the tile hierarchy's bounding volumes for speed).
 * Maintains a flat box collider at the detected ground height so the
 * Rapier vehicle has something to drive on.
 *
 * This approach is simpler and more reliable than extracting trimesh
 * geometry from tiles, which has timing and matrix chain issues.
 */
export function useTileColliders(tiles: TilesRendererLike | null) {
  const { world, rapier } = useRapier();

  const worldRef = useRef(world);
  const rapierRef = useRef(rapier);
  worldRef.current = world;
  rapierRef.current = rapier;

  // The ground collider — a large flat box repositioned each check
  const groundCollider = useRef<Collider | null>(null);
  const lastGroundY = useRef<number | null>(null);

  // Create the ground collider once
  useEffect(() => {
    const desc = rapierRef.current.ColliderDesc.cuboid(
      GROUND_HALF,
      0.1,
      GROUND_HALF,
    );
    desc.friction = FRICTION;
    // Start it far below so it doesn't interfere before first raycast hit
    desc.setTranslation(0, -1000, 0);
    const collider = worldRef.current.createCollider(desc);
    groundCollider.current = collider;

    return () => {
      if (groundCollider.current) {
        worldRef.current.removeCollider(groundCollider.current, true);
        groundCollider.current = null;
      }
    };
  }, []);

  useFrame(({ camera }) => {
    if (!tiles || !groundCollider.current) return;

    const group = tiles.group;
    if (!group) return;

    // Use camera position as proxy for car position
    const cx = camera.position.x;
    const cz = camera.position.z;

    // Cast a grid of rays downward and find the highest hit
    let bestY: number | null = null;

    _raycaster.firstHitOnly = true;
    _raycaster.far = RAY_MAX;

    const halfGrid = Math.floor(RAY_GRID_SIZE / 2);
    for (let gx = -halfGrid; gx <= halfGrid; gx++) {
      for (let gz = -halfGrid; gz <= halfGrid; gz++) {
        _origin.set(
          cx + gx * RAY_SPACING,
          camera.position.y + RAY_ORIGIN_OFFSET,
          cz + gz * RAY_SPACING,
        );
        _raycaster.set(_origin, _down);

        const hits = _raycaster.intersectObject(group, true);
        if (hits.length > 0) {
          const hitY = hits[0].point.y;
          if (bestY === null || hitY > bestY) {
            bestY = hitY;
          }
        }
      }
    }

    if (bestY !== null) {
      // Smooth the ground height to avoid jitter
      if (lastGroundY.current === null) {
        lastGroundY.current = bestY;
      } else {
        lastGroundY.current += (bestY - lastGroundY.current) * 0.3;
      }

      // Position the collider box so its top surface is at ground height
      // Box half-height is 0.1, so center goes at groundY - 0.1
      const collider = groundCollider.current;
      collider.setTranslation({
        x: cx,
        y: lastGroundY.current - 0.1,
        z: cz,
      });
    }
  });
}
