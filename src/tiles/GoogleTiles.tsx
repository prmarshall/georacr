import { useMemo } from "react";
import {
  TilesRenderer,
  TilesPlugin,
  TilesAttributionOverlay,
} from "3d-tiles-renderer/r3f";
import { CachedGoogleCloudAuthPlugin } from "./CachedGoogleCloudAuthPlugin";
import { GLTFExtensionsPlugin } from "3d-tiles-renderer/plugins";
import { WGS84_ELLIPSOID } from "3d-tiles-renderer/three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { Matrix4, Vector3, Quaternion, MathUtils } from "three";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

// Times Square, NYC
const DEFAULT_LAT = 40.758;
const DEFAULT_LON = -73.986;
const DEFAULT_HEIGHT = 0;

interface GoogleTilesProps {
  lat?: number;
  lon?: number;
  height?: number;
}

export function GoogleTiles({
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
  height = DEFAULT_HEIGHT,
}: GoogleTilesProps) {
  const apiKey = import.meta.env.VITE_MAP_TILES_API_TOKEN as string;

  // Compute the ECEF-to-local transform so the target location sits at the
  // scene origin with the surface flat on the XZ plane.
  const groupProps = useMemo(() => {
    // ENU frame: X=East, Y=North, Z=Up (in ECEF space)
    const enuMatrix = new Matrix4();
    WGS84_ELLIPSOID.getEastNorthUpFrame(
      MathUtils.degToRad(lat),
      MathUtils.degToRad(lon),
      height,
      enuMatrix,
    );

    // Invert: ECEF → ENU-local (target point at origin, but Z-up)
    const inverseEnu = enuMatrix.clone().invert();

    // Swap Z-up (ENU) → Y-up (Three.js) via -90° X rotation.
    // Result: East=+X, North=-Z (matches our -Z forward convention), Up=+Y
    const swapAxes = new Matrix4().makeRotationX(-Math.PI / 2);
    const combined = swapAxes.multiply(inverseEnu);

    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    combined.decompose(position, quaternion, scale);

    return {
      position: position.toArray() as [number, number, number],
      quaternion: quaternion.toArray() as [number, number, number, number],
    };
  }, [lat, lon, height]);

  if (!apiKey) {
    console.warn("GoogleTiles: VITE_MAP_TILES_API_TOKEN not set in .env");
    return null;
  }

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <TilesRenderer group={groupProps as any} errorTarget={6}>
      <TilesPlugin
        plugin={CachedGoogleCloudAuthPlugin}
        args={[{ apiToken: apiKey }]}
      />
      <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader }]} />
      <TilesAttributionOverlay />
    </TilesRenderer>
  );
}
