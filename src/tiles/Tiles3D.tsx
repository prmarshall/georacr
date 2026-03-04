import { useCallback, useState } from "react";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GLTFExtensionsPlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { RapierRigidBody } from "@react-three/rapier";
import { useTileColliders } from "./useTileColliders";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

const DINGO_GAP_URL =
  "https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize_tileset.json";

interface Tiles3DProps {
  vehicleBodyRef?: React.RefObject<RapierRigidBody | null>;
}

export function Tiles3D({ vehicleBodyRef }: Tiles3DProps) {
  // Callback ref + state: when TilesRenderer sets the ref, state update
  // triggers a re-render so useTileColliders receives the instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tilesInstance, setTilesInstance] = useState<any>(null);
  const tilesCallbackRef = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance: any) => setTilesInstance(instance),
    [],
  );

  // Raycast-based ground collider — tracks car over tile terrain
  useTileColliders(tilesInstance, vehicleBodyRef);

  return (
    <TilesRenderer
      ref={tilesCallbackRef}
      url={DINGO_GAP_URL}
      errorTarget={6}
      group={{ rotation: [Math.PI / 2, 0, 0] } as any}
    >
      <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader }]} />
    </TilesRenderer>
  );
}
