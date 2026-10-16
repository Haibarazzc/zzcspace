import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { poses, type PoseId } from './data'

const skyColors = {
  stand: { zenith: '#819cac', lower: '#697d66', cloud: '#e8e9da', cloudAmount: .20 },
  cheer: { zenith: '#a8a4a0', lower: '#7f856a', cloud: '#f2e6ce', cloudAmount: .18 },
  glance: { zenith: '#15243b', lower: '#263d3c', cloud: '#65778b', cloudAmount: .06 },
}

export default function MountainSky({ pose }: { pose: PoseId }) {
  const sky = useMemo(() => ({
    geometry: new T.SphereGeometry(85, 32, 20),
    material: new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
      uniforms: {
        zenith: { value: new T.Color(skyColors.stand.zenith) },
        horizon: { value: new T.Color(poses.stand.background) },
        lower: { value: new T.Color(skyColors.stand.lower) },
        cloud: { value: new T.Color(skyColors.stand.cloud) },
        cloudAmount: { value: skyColors.stand.cloudAmount },
        sunDirection: { value: new T.Vector3(...poses.stand.position).normalize() },
        sunColor: { value: new T.Color(poses.stand.sun) },
      },
      vertexShader: `
        varying vec3 worldPoint;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          worldPoint = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        varying vec3 worldPoint;
        uniform vec3 zenith, horizon, lower, cloud, sunDirection, sunColor;
        uniform float cloudAmount;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec3 direction = normalize(worldPoint - cameraPosition);
          vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.72, direction.y));
          color = mix(lower, color, smoothstep(-0.24, 0.025, direction.y));
          // A static, soft cloud layer keeps pause and reduced-motion behavior
          // predictable and avoids extra transparent meshes in the distance.
          vec2 p = direction.xz / max(0.18, direction.y + 0.36) * 2.4;
          float n = noise(p) * 0.56 + noise(p * 2.03 + 17.3) * 0.28 + noise(p * 4.11) * 0.14;
          float wisps = smoothstep(0.48, 0.76, n) * smoothstep(0.07, 0.26, direction.y)
            * (1.0 - smoothstep(0.65, 0.92, direction.y));
          color = mix(color, cloud, wisps * cloudAmount);
          float glow = pow(max(0.0, dot(direction, sunDirection)), 32.0);
          color += sunColor * glow * 0.045;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  }), [])
  const target = useMemo(() => ({
    zenith: new T.Color(skyColors[pose].zenith), horizon: new T.Color(poses[pose].background),
    lower: new T.Color(skyColors[pose].lower), cloud: new T.Color(skyColors[pose].cloud),
    sunColor: new T.Color(poses[pose].sun), sunDirection: new T.Vector3(...poses[pose].position).normalize(),
    cloudAmount: skyColors[pose].cloudAmount,
  }), [pose])
  useEffect(() => () => { sky.geometry.dispose(); sky.material.dispose() }, [sky])
  useFrame((_, dt) => {
    const uniforms = sky.material.uniforms, amount = 1 - Math.exp(-Math.min(dt, .05) * 2)
    for (const key of ['zenith', 'horizon', 'lower', 'cloud', 'sunColor'] as const) uniforms[key].value.lerp(target[key], amount)
    uniforms.sunDirection.value.lerp(target.sunDirection, amount).normalize()
    uniforms.cloudAmount.value = T.MathUtils.lerp(uniforms.cloudAmount.value, target.cloudAmount, amount)
  })
  return <mesh geometry={sky.geometry} material={sky.material} renderOrder={-1000} frustumCulled={false} raycast={() => {}} dispose={null} />
}
