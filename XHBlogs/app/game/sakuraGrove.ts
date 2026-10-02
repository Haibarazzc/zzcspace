// 樱花树生成器：从 qixia（樱花古境）移植，供赛车赛道使用。
// 与 ZZC/src/shizi/sakuraGrove.ts 同源；增加 game 密度档（花量约 1/3）以控制总面数。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Instance = { matrix: THREE.Matrix4; color: THREE.Color };

function blossomRandom(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createPetalGeometry(segments = 5) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.55);
  shape.bezierCurveTo(-0.55, -0.18, -0.5, 0.55, -0.13, 0.48);
  shape.lineTo(0, 0.32); shape.lineTo(0.13, 0.48);
  shape.bezierCurveTo(0.5, 0.55, 0.55, -0.18, 0, -0.55);
  const geometry = new THREE.ShapeGeometry(shape, segments), positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setZ(i, 0.3 * positions.getX(i) ** 2 + 0.12 * positions.getY(i));
  geometry.computeVertexNormals();
  return geometry;
}

function createFlowerGeometry() {
  const petal = createPetalGeometry(2), parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) parts.push(petal.clone().scale(0.52, 0.65, 0.6).translate(0, 0.32, 0).rotateZ(i * Math.PI * 2 / 5));
  const center = new THREE.CircleGeometry(0.085, 8); center.translate(0, 0, 0.04); parts.push(center);
  parts.forEach((part, i) => {
    const color = new THREE.Color(i === 5 ? '#b95c84' : '#ffffff'), colors: number[] = [];
    for (let j = 0; j < part.getAttribute('position').count; j++) colors.push(color.r, color.g, color.b);
    part.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  });
  const geometry = mergeGeometries(parts)!;
  petal.dispose(); parts.forEach(part => part.dispose());
  return geometry;
}

const BLOSSOM_COLORS = ['#fff1f1', '#f3cdda', '#edb8cc', '#ffe9ed', '#e2b0c4'];

// game 档：侧枝 5→3、细枝 4→3、每点花 3→2，单棵约 750 朵（full 约 2500）
function buildOneTree(seed: number, game: boolean) {
  const branches: THREE.BufferGeometry[] = [];
  const flowers: Instance[] = [];
  const dummy = new THREE.Object3D();
  const rnd = (n: number) => blossomRandom(seed * 101 + n);
  const height = 2.5 + rnd(1) * 0.65, rotation = rnd(2) * Math.PI * 2, spread = 0.88 + rnd(3) * 0.2;
  const lean = new THREE.Vector3(Math.cos(rotation) * 0.32, 0, Math.sin(rotation) * 0.32);

  const branch = (points: THREE.Vector3[], base: number, tip: number, segments: number, sides: number) => {
    const curve = new THREE.CatmullRomCurve3(points), geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false);
    const positions = geometry.getAttribute('position'), colors: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, center = curve.getPointAt(t), radius = THREE.MathUtils.lerp(base, tip, t);
      for (let j = 0; j <= sides; j++) {
        const k = i * (sides + 1) + j, p = new THREE.Vector3().fromBufferAttribute(positions, k);
        const furrow = 1 + 0.065 * Math.sin(j / sides * Math.PI * 8 + seed) + 0.025 * Math.sin(t * 22 + seed);
        p.sub(center).multiplyScalar(radius * furrow).add(center); positions.setXYZ(k, p.x, p.y, p.z);
        const color = new THREE.Color(j % 3 === 0 ? '#554449' : j % 3 === 1 ? '#372d32' : '#45383b');
        colors.push(color.r, color.g, color.b);
      }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); branches.push(geometry);
    return curve;
  };
  const flower = (point: THREE.Vector3, count: number, n: number) => {
    for (let i = 0; i < count; i++) {
      const k = n + i * 13, angle = rnd(k + 4) * Math.PI * 2, radius = 0.035 + rnd(k + 8) * 0.105;
      dummy.position.copy(point).add(new THREE.Vector3(Math.cos(angle) * radius, (rnd(k + 9) - 0.4) * 0.16, Math.sin(angle) * radius));
      dummy.rotation.set(rnd(k + 14) * Math.PI * 2, rnd(k + 16) * Math.PI * 2, rnd(k + 18) * Math.PI * 2);
      dummy.scale.setScalar(0.07 + rnd(k + 20) * 0.055); dummy.updateMatrix();
      flowers.push({ matrix: dummy.matrix.clone(), color: new THREE.Color(BLOSSOM_COLORS[Math.floor(rnd(k + 22) * 5)]) });
    }
  };

  const trunk = branch([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-lean.x * 0.35, 0.74, -lean.z * 0.35),
    new THREE.Vector3(lean.x * 0.7, 1.44, lean.z * 0.7),
    new THREE.Vector3(lean.x, height - 0.66, lean.z),
  ], 0.18, 0.072, 10, 10);
  const lateralsPerBranch = game ? 3 : 5;
  const twigsPerLateral = game ? 3 : 4;
  const flowersPerSpot = game ? 2 : 3;
  for (let i = 0; i < 6; i++) {
    const angle = rotation + i * 2.399 + (rnd(i + 30) - 0.5) * 0.35, length = (1.65 + rnd(i + 40) * 0.55) * spread;
    const start = trunk.getPoint(0.5 + i * 0.083), out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const lift = 0.65 + rnd(i + 50) * 1.1;
    const main = branch([
      start,
      start.clone().addScaledVector(out, length * 0.25).add(new THREE.Vector3(0, 0.2, 0)),
      start.clone().addScaledVector(out, length * 0.7).add(new THREE.Vector3(0, lift * 0.72, 0)),
      start.clone().addScaledVector(out, length).add(new THREE.Vector3(0, lift, 0)),
    ], 0.09 - i * 0.005, 0.025, 7, 7);
    for (let j = 0; j < lateralsPerBranch; j++) {
      const n = i * 900 + j * 120 + 60, origin = main.getPoint(0.3 + j * 0.14), side = j % 2 ? 1 : -1;
      const direction = angle + side * (0.45 + rnd(n) * 0.65), reach = (0.62 + rnd(n + 1) * 0.55) * spread;
      const lateral = new THREE.Vector3(Math.cos(direction) * reach, 0.18 + rnd(n + 2) * 0.5, Math.sin(direction) * reach);
      const secondary = branch([
        origin,
        origin.clone().addScaledVector(lateral, 0.48).add(new THREE.Vector3(0, 0.08, 0)),
        origin.clone().add(lateral),
      ], 0.029, 0.009, 5, 5);
      for (let k = 0; k < twigsPerLateral; k++) {
        const m = n + k * 29, at = secondary.getPoint(0.2 + k * 0.22), a = direction + (k % 2 ? 1 : -1) * (0.6 + rnd(m + 5) * 0.5);
        const extent = 0.37 + rnd(m + 6) * 0.4, dy = (k === 3 ? -0.18 : 0.12) + rnd(m + 7) * 0.24;
        const end = at.clone().add(new THREE.Vector3(Math.cos(a) * extent, dy, Math.sin(a) * extent));
        const twig = branch([at, at.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.1, 0)), end], 0.011, 0.003, 3, 4);
        for (let b = 0; b < 6; b++) flower(twig.getPoint(0.2 + b * 0.155), flowersPerSpot, m * 31 + b * 8);
      }
      for (let b = 0; b < 4; b++) flower(secondary.getPoint(0.44 + b * 0.17), flowersPerSpot, n * 41 + b * 17);
    }
  }
  return { branches, flowers };
}

export interface SakuraTreeSpec { x: number; z: number; seed: number; scale?: number }

export function buildSakuraGrove(specs: SakuraTreeSpec[]) {
  const group = new THREE.Group();
  const allBranches: THREE.BufferGeometry[] = [];
  const allFlowers: Instance[] = [];
  for (const spec of specs) {
    const tree = buildOneTree(spec.seed, true);
    const place = new THREE.Matrix4().compose(
      new THREE.Vector3(spec.x, 0, spec.z), new THREE.Quaternion(),
      new THREE.Vector3(spec.scale ?? 1, spec.scale ?? 1, spec.scale ?? 1));
    tree.branches.forEach(g => { g.applyMatrix4(place); allBranches.push(g); });
    tree.flowers.forEach(i => allFlowers.push({ matrix: place.clone().multiply(i.matrix), color: i.color }));
  }
  const flowerGeo = createFlowerGeometry();
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide, vertexColors: true, emissive: '#c1789c', emissiveIntensity: 0.03 });
  const branchMat = new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true });
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, allFlowers.length);
  allFlowers.forEach((v, i) => { flowerMesh.setMatrixAt(i, v.matrix); flowerMesh.setColorAt(i, v.color); });
  const bark = new THREE.Mesh(mergeGeometries(allBranches)!, branchMat);
  bark.castShadow = true; bark.receiveShadow = true;
  group.add(bark, flowerMesh);
  return group;
}
