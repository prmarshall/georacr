import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Object3D, Vector3 } from "three";
import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";

const ORBIT_DISTANCE = 12;
const MOUSE_SENSITIVITY = 0.003;
const cameraTargetOffset = new Vector3(0, 1.5, 0);

const _bodyPosition = new Vector3();
const _cameraPosition = new Vector3();
const _cameraTarget = new Vector3();

export function useChaseCamera(
  chassisMeshRef: React.RefObject<Object3D | null>,
  vehicleController: React.RefObject<DynamicRayCastVehicleController | null>,
  gl: { domElement: HTMLCanvasElement },
) {
  // Camera orbit state — mouse offset decays back to 0 (behind vehicle)
  const mouseAzimuthOffset = useRef(0);
  const mouseElevationOffset = useRef(0);
  const orbitElevation = useRef(0.35);
  const lastMouseMoveTime = useRef(0);
  const smoothedYaw = useRef(0);

  const [smoothedCameraPosition] = useState(new Vector3(0, 5, 8));
  const [smoothedCameraTarget] = useState(new Vector3());

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      canvas.requestPointerLock();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      mouseAzimuthOffset.current -= e.movementX * MOUSE_SENSITIVITY;
      mouseElevationOffset.current += e.movementY * MOUSE_SENSITIVITY;
      lastMouseMoveTime.current = performance.now();
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!chassisMeshRef.current || !vehicleController.current) return;

    const t = 1.0 - 0.01 ** delta;
    const controller = vehicleController.current;
    const chassisRigidBody = controller.chassis();

    const bodyPosition = chassisMeshRef.current.getWorldPosition(_bodyPosition);

    // Extract vehicle yaw from chassis quaternion
    const chassisRot = chassisRigidBody.rotation();
    const vehicleYaw = Math.atan2(
      2 * (chassisRot.w * chassisRot.y + chassisRot.x * chassisRot.z),
      1 - 2 * (chassisRot.y * chassisRot.y + chassisRot.z * chassisRot.z),
    );

    // GTA5-style chase cam: camera slows down during sharp turns,
    // then swings back behind when the turn rate drops.
    let yawDelta = vehicleYaw - smoothedYaw.current;
    // Wrap to [-PI, PI] for shortest rotation path
    yawDelta = ((yawDelta + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;

    // Yaw rate from physics angular velocity (Y axis)
    const angvel = chassisRigidBody.angvel();
    const yawRate = Math.abs(angvel.y);

    // High yaw rate → camera gives up following (low lerp)
    // Low yaw rate → camera snaps back behind (high lerp)
    const baseLerp = 1.0 - 0.02 ** delta;
    const sharpTurnFactor = MathUtils.clamp(1.0 - yawRate / 3.0, 0.05, 1.0);
    smoothedYaw.current += yawDelta * baseLerp * sharpTurnFactor;

    // Decay mouse offset back to 0 after 1s idle (camera returns behind vehicle)
    const mouseIdleMs = performance.now() - lastMouseMoveTime.current;
    if (mouseIdleMs > 1000) {
      const decayRate = 1.0 - 0.05 ** delta;
      mouseAzimuthOffset.current *= 1.0 - decayRate;
      mouseElevationOffset.current *= 1.0 - decayRate;
    }

    // Chase azimuth follows smoothed yaw (azimuth 0 = behind car at +Z)
    const azimuth = smoothedYaw.current + mouseAzimuthOffset.current;
    const elevation = MathUtils.clamp(
      orbitElevation.current + mouseElevationOffset.current,
      -0.2,
      Math.PI / 3,
    );

    const cameraPosition = _cameraPosition;
    cameraPosition.set(
      Math.cos(elevation) * Math.sin(azimuth) * ORBIT_DISTANCE,
      Math.sin(elevation) * ORBIT_DISTANCE + 1.5,
      Math.cos(elevation) * Math.cos(azimuth) * ORBIT_DISTANCE,
    );
    cameraPosition.add(bodyPosition);

    cameraPosition.y = Math.max(
      cameraPosition.y,
      (vehicleController.current?.chassis().translation().y ?? 0) + 0.5,
    );

    smoothedCameraPosition.lerp(cameraPosition, t);
    state.camera.position.copy(smoothedCameraPosition);

    // camera target
    const cameraTarget = _cameraTarget;
    cameraTarget.copy(bodyPosition);
    cameraTarget.add(cameraTargetOffset);
    smoothedCameraTarget.lerp(cameraTarget, t);

    state.camera.lookAt(smoothedCameraTarget);
  });
}
