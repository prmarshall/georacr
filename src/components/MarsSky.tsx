import { useMemo } from "react";
import { BackSide, Color } from "three";

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Push to max depth so it's always behind everything
    pos.z = pos.w;
    gl_Position = pos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uGround;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float y = dir.y;

    // Above horizon: blend horizon → zenith
    // Below horizon: blend horizon → ground
    vec3 color = y >= 0.0
      ? mix(uHorizon, uZenith, smoothstep(0.0, 0.6, y))
      : mix(uHorizon, uGround, smoothstep(0.0, -0.3, y));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function MarsSky({ distance = 9000 }: { distance?: number }) {
  const uniforms = useMemo(
    () => ({
      uHorizon: { value: new Color("#c8b898") },
      uZenith: { value: new Color("#4a6d8c") },
      uGround: { value: new Color("#a89070") },
    }),
    [],
  );

  return (
    <mesh scale={[distance, distance, distance]} renderOrder={-1000}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
