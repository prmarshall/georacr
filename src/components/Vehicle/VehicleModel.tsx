import { useGLTF } from "@react-three/drei";
import { forwardRef, useEffect } from "react";
import { Object3D, Vector3 } from "three";

interface VehicleModelProps {
  url: string;
  wheelsRef: React.RefObject<(Object3D | null)[]>;
  onWheelPositions: (positions: Vector3[]) => void;
}

export const VehicleModel = forwardRef<Object3D, VehicleModelProps>(
  function VehicleModel({ url, wheelsRef, onWheelPositions }, ref) {
    const { scene, nodes } = useGLTF(url);

    useEffect(() => {
      // Ensure matrices are up-to-date so getWorldPosition works
      scene.updateMatrixWorld(true);

      const positions: Vector3[] = [];
      let i = 1;
      while (true) {
        const node = nodes[`Wheel_${i}`];
        if (!node) break;
        wheelsRef.current[i - 1] = node;
        // Use worldToLocal to get position relative to scene root (chassis),
        // not node.position which is relative to the node's parent and may
        // be nested deeper in the hierarchy.
        const pos = new Vector3();
        node.getWorldPosition(pos);
        scene.worldToLocal(pos);
        positions.push(pos);
        i++;
      }
      onWheelPositions(positions);
    }, [nodes, scene, wheelsRef, onWheelPositions]);

    return <primitive ref={ref} object={scene} />;
  },
);
