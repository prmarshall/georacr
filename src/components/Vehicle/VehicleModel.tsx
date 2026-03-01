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
      const positions: Vector3[] = [];
      let i = 1;
      while (true) {
        const node = nodes[`Wheel_${i}`];
        if (!node) break;
        wheelsRef.current[i - 1] = node;
        positions.push(node.position.clone());
        i++;
      }
      onWheelPositions(positions);
    }, [nodes, wheelsRef, onWheelPositions]);

    return <primitive ref={ref} object={scene} />;
  },
);
