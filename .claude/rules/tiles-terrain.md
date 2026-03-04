---
paths:
  - "src/tiles/**"
---

# 3D Tiles Terrain

- **Library:** `3d-tiles-renderer` (v0.4.21) with R3F bindings (`3d-tiles-renderer/r3f`).
- **Current tileset:** NASA Dingo Gap Mars. No API key required.
- **Component:** `Tiles3D` in `src/tiles/Tiles3D.tsx`. `<TilesRenderer url={...}>` with DRACO loader plugin.
- **Coordinate fix:** Tileset is Z-up; Three.js is Y-up. Group rotation `[Math.PI / 2, 0, 0]`. Do NOT use `-Math.PI / 2` — flips upside down.
- **DRACO:** `GLTFExtensionsPlugin` with `DRACOLoader` pointing to `gstatic.com/draco/versioned/decoders/1.5.7/`.
- **Google Tiles (disabled):** `CachedGoogleCloudAuthPlugin.ts` exists for Google Photorealistic 3D Tiles (requires `VITE_MAP_TILES_API_TOKEN`). Currently unused.

## Tile Collision System (`useTileColliders.ts`)

- **Trimesh colliders:** Each visible tile mesh gets a Rapier `trimesh` collider. Vertices baked into world space.
- **LOD tracking:** Per-frame diff of visible meshes by `uuid`. New → create collider. Removed → remove from Rapier world.
- **Bounding box walls:** 4 invisible cuboid wall colliders (0.5m thick, 10m tall) around tile edges.
- **Debug viz:** Toggleable via `useDebugStore`. Red `Box3Helper`, tile wireframe, close cam `CameraHelper`. Wireframe reads `getState()` in `useFrame`.
- **Friction:** All colliders use friction 1.5.
- **Cleanup:** All colliders and helpers removed on unmount.

## Vehicle LOD Camera System

Main chase camera is **unregistered** from `TilesRenderer` and replaced by two dedicated LOD cameras:

1. **Close cam** (distance 1): Behind vehicle on XZ plane. Forces finest LOD under car. 120° FOV.
2. **Coverage cam** (distance 15): Beyond chase camera's orbit distance (12). Fills in surrounding tiles. 120° FOV.

### Critical Implementation Details

- **Flat-plane orbit:** Both LOD cameras orbit on XZ plane only (azimuth from viewer, ignoring elevation). Height always `vehicle.y`.
- **Vehicle body tracking:** Read `vehicleBodyRef.translation()` each frame. **Always guard with `body.isValid()`** — stale refs after vehicle remount crash WASM.
- **Main camera unregistration:** After `deleteCamera(mainCam)`, per-frame `setResolutionFromRenderer` harmlessly returns false.
- **Frame ordering:** LOD camera update at `useFrame` priority `-1` (before `tiles.update()` at priority 0).
- **Resolution registration:** `tiles.setResolutionFromRenderer(cam, gl)` must be called each frame for BOTH cameras.
- **SSE:** `geometricError / (distance × sseDenominator)`. `errorTarget` = 6 (default 16).

### Tunables

- `CLOSE_CAM_DISTANCE` (1), `COVERAGE_CAM_DISTANCE` (15), `LOD_CAM_FAR` (150), `errorTarget` (6)

### LOD Edge Artifacts (By Design)

Edge tiles appear higher quality from distance — this is inherent to REPLACE refinement, not a bug. Parent tile looks smooth at distance; children at edges have coarse geometry from sparse camera coverage.

### Switching Tilesets

- **Public:** Set `url` prop on `<TilesRenderer>`.
- **Google Photorealistic:** Remove `url`, add `CachedGoogleCloudAuthPlugin`, set env var, restore WGS84 transform (commit `6abb416`).
- **Cesium Ion:** Use `CesiumIonAuthPlugin` from `3d-tiles-renderer/plugins`.
