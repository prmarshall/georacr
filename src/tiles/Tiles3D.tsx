import { useCallback, useState } from "react";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { TilesRenderer as TilesRendererImpl } from "3d-tiles-renderer/three";
import { GLTFExtensionsPlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { RapierRigidBody } from "@react-three/rapier";
import { useTileColliders } from "./useTileColliders";
import { TILESET } from "@/constants";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

interface Tiles3DProps {
  vehicleBodyRef?: React.RefObject<RapierRigidBody | null>;
}

export function Tiles3D({ vehicleBodyRef }: Tiles3DProps) {
  // Callback ref + state: when TilesRenderer sets the ref, state update
  // triggers a re-render so useTileColliders receives the instance.
  const [tilesInstance, setTilesInstance] = useState<TilesRendererImpl | null>(
    null,
  );
  const tilesCallbackRef = useCallback(
    (instance: TilesRendererImpl | null) => setTilesInstance(instance),
    [],
  );

  // Raycast-based ground collider — tracks car over tile terrain
  useTileColliders(tilesInstance, vehicleBodyRef);

  return (
    <TilesRenderer
      ref={tilesCallbackRef}
      url={TILESET.dingoGap}
      errorTarget={6}
      group={
        {
          rotation: [Math.PI / 2, 0, 0],
        } as unknown as TilesRendererImpl["group"]
      }
    >
      <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader }]} />
    </TilesRenderer>
  );
}
