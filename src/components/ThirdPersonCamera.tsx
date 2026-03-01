import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { Euler, Quaternion, Vector3 } from "three";

interface ThirdPersonCameraProps {
  targetRef: React.RefObject<RapierRigidBody | null>;
  offset?: [number, number, number];
  smoothing?: number;
}

const _idealPos = new Vector3();
const _targetPos = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();

export function ThirdPersonCamera({
  targetRef,
  offset = [0, 4, 8],
  smoothing = 0.3,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const currentPos = useRef(new Vector3(0, 4, 8));

  useFrame(() => {
    const body = targetRef.current;
    if (!body) return;

    const pos = body.translation();
    const rot = body.rotation();

    _targetPos.set(pos.x, pos.y, pos.z);

    // Extract only yaw from chassis rotation to avoid pitch/roll camera shake
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _euler.setFromQuaternion(_quat, "YXZ");
    _quat.setFromEuler(_euler.set(0, _euler.y, 0));

    // Compute ideal camera position: offset rotated by yaw only
    _idealPos.set(offset[0], offset[1], offset[2]);
    _idealPos.applyQuaternion(_quat);
    _idealPos.add(_targetPos);

    // Lerp toward ideal
    currentPos.current.lerp(_idealPos, smoothing);

    camera.position.copy(currentPos.current);
    camera.lookAt(_targetPos);
  });

  return null;
}
