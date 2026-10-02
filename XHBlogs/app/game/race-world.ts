import * as THREE from 'three';
import { Race, type Racer, type Track, wrap } from './race-model';
import { buildSakuraGrove } from './sakuraGrove';

type CarVisual = { group: THREE.Group; body: THREE.Group; wheels: THREE.Mesh[]; jets: THREE.Mesh[]; shadow: THREE.Mesh; label?: THREE.Sprite };
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };

// A small procedural world: all scenery and vehicles ship with the game, no remote assets.
export class RaceWorld {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, .2, 1800);
  private stage = new THREE.Group();
  private cars: CarVisual[] = [];
  private particles: Particle[] = [];
  private particleCursor = 0;
  private follow = new THREE.Vector3();
  private look = new THREE.Vector3();
  private cameraReady = false;
  private sun = new THREE.DirectionalLight('#fff5da', 2.9);
  private elapsed = 0;
  private textures = new Set<THREE.Texture>();
  private observer: ResizeObserver;
  private track: Track;
  private reducedMotion: boolean;
  private particleClock = 0;
  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, race: Race, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.track = race.track;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.17;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#acdbea');
    this.scene.fog = new THREE.Fog('#cce4df', 260, 1100);
    this.scene.add(new THREE.HemisphereLight('#ddf5ff', '#7a9973', 2.6));
    this.sun.position.set(-100, 140, 60); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 420 });
    this.sun.shadow.bias = -.0007; this.sun.shadow.normalBias = .07;
    this.scene.add(this.sun, this.sun.target, this.stage);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host); this.resize(); this.rebuild(race);
  }
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setQuality(value: 'high' | 'low') {
    this.renderer.setPixelRatio(value === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = value === 'high'; this.resize();
  }
  rebuild(race: Race) {
    this.disposeStage(); this.track = race.track; this.cameraReady = false;
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    this.buildScenery();
    this.cars = race.racers.map(r => this.buildCar(r));
    const particleGeo = new THREE.IcosahedronGeometry(.13, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: '#55deff', transparent: true, depthWrite: false });
    this.particles = Array.from({ length: 100 }, () => {
      const mesh = new THREE.Mesh(particleGeo, particleMat.clone());
      mesh.visible = false; this.stage.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1 };
    });
    particleMat.dispose();
  }
  private material(color: THREE.ColorRepresentation, roughness = .8) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: .04 });
  }
  private box(parent: THREE.Group, size: number[], at: number[], material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
    mesh.position.set(...at as [number, number, number]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private hull(parent: THREE.Group, bottom: number[], top: number[], material: THREE.Material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([...bottom, ...top], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private ribbon(left: number, right: number, y: number, colors: string[], dashed = false, from = 0, to = this.track.length) {
    const positions: number[] = [], rgb: number[] = [];
    const steps = Math.ceil((to - from) / 2);
    for (let i = 0; i < steps; i++) {
      const distance = from + (to - from) * i / steps;
      if (dashed && Math.floor(distance / 7) % 3 !== 0) continue;
      const next = from + (to - from) * (i + 1) / steps;
      const a = this.track.sample(distance, left), b = this.track.sample(distance, right);
      const c = this.track.sample(next, left), d = this.track.sample(next, right);
      const color = new THREE.Color(colors[Math.floor(distance / 5) % colors.length]);
      for (const p of [a, c, b, b, c, d]) { positions.push(p.x, y, p.z); rgb.push(color.r, color.g, color.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide }));
    mesh.receiveShadow = true; this.stage.add(mesh); return mesh;
  }
  private texture(text: string, background: string, color: string, width = 512, height = 100) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.font = `900 ${height * .49}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture); return texture;
  }
  private buildScenery() {
    const track = this.track, half = track.width / 2, coast = track.id === 'coast';
    const mint = coast ? '#72baaf' : '#97be90';
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), this.material(mint));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -.1; grass.receiveShadow = true; this.stage.add(grass);
    const water = new THREE.Mesh(new THREE.CircleGeometry(coast ? 100 : 64, 80), this.material('#6ec5d1', .28));
    water.rotation.x = -Math.PI / 2; water.position.set(coast ? 420 : 135, .025, coast ? 170 : 70); water.scale.set(1, 1.45, 1); this.stage.add(water);
    if (coast) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 2200), this.material('#71c6d2', .3));
      sea.rotation.x = -Math.PI / 2; sea.position.set(1050, -.03, 0); this.stage.add(sea);
    }
    this.ribbon(-half - 2.8, half + 2.8, .02, [coast ? '#ecdfbb' : '#bed1aa']);
    this.ribbon(-half, half, .06, ['#66777d']);
    this.ribbon(-half, -half + .8, .08, ['#f6f2e6', '#e888a0']);
    this.ribbon(half - .8, half, .08, ['#f6f2e6', '#e888a0']);
    for (const lane of [-half / 2, 0, half / 2]) this.ribbon(lane - .09, lane + .09, .085, ['#d0d7cb'], true);
    this.ribbon(-half + 1.1, -half + 1.24, .085, ['#e7e7d8']);
    this.ribbon(half - 1.24, half - 1.1, .085, ['#e7e7d8']);
    // Low, continuous barriers leave the view open while making the usable width legible.
    for (const side of [-1, 1]) {
      const edge = side * (half + .45);
      this.ribbon(edge - .3, edge + .3, .92, ['#faf5e6']);
      this.ribbon(edge - .26, edge + .26, .37, ['#e994a9']);
      const postCount = Math.ceil(track.length / 7);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.3, 1, .3), this.material('#e8e8d6'), postCount);
      const m = new THREE.Object3D();
      for (let i = 0; i < postCount; i++) {
        const p = track.sample(i / postCount * track.length, edge); m.position.set(p.x, .48, p.z); m.updateMatrix(); posts.setMatrixAt(i, m.matrix);
      }
      this.stage.add(posts);
    }
    for (const distance of track.pads) {
      this.ribbon(-6, 6, .10, ['#39bacc'], false, distance, distance + 10);
      for (let k = 1; k <= 3; k++) {
        const p = track.sample(distance + k * 2.5), g = new THREE.Group(); g.position.set(p.x, .12, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
        const mat = this.material('#dcffff');
        const a = this.box(g, [4, .02, .35], [-1.4, 0, 0], mat); a.rotation.y = -.42;
        const b = this.box(g, [4, .02, .35], [1.4, 0, 0], mat); b.rotation.y = .42; this.stage.add(g);
      }
    }
    // Starting grid and checkerboard line.
    for (let row = 0; row < 2; row++) for (let x = -half; x < half; x += 1.5) this.ribbon(x, x + 1.5, .11, [(Math.round(x / 1.5) + row) % 2 ? '#fffaf1' : '#263e4b'], false, row * 1.5, (row + 1) * 1.5);
    for (let i = 0; i < 8; i++) {
      const d = -12 - Math.floor(i / 2) * 9, lane = i % 2 ? 4 : -4;
      this.ribbon(lane - 1.8, lane + 1.8, .10, ['#dfe1d6'], false, d + 3, d + 3.2);
    }
    const finish = new THREE.Group(), point = track.sample(1);
    finish.position.set(point.x, 0, point.z); finish.rotation.y = Math.atan2(point.tx, point.tz);
    const archMat = this.material('#f3f3e9'), darkMat = this.material('#243f4c');
    this.box(finish, [1.1, 10, 1.1], [-half - 1, 5, 0], archMat);
    this.box(finish, [1.1, 10, 1.1], [half + 1, 5, 0], archMat);
    this.box(finish, [track.width + 3, 2.3, 1.2], [0, 9.2, 0], darkMat);
    const signMat = new THREE.MeshBasicMaterial({ map: this.texture(coast ? 'SEASIDE  /  RACING CLUB' : 'SAKURA  /  RACING CLUB', '#243f4c', '#ffffff'), side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(track.width, 2.1), signMat);
    sign.position.set(0, 9.2, -.62); sign.rotation.y = Math.PI; finish.add(sign);
    this.stage.add(finish);
    this.buildTrees(coast);
    if (!coast) this.buildQixiaDecor();
    const dummy = new THREE.Object3D();
    if (!coast) this.buildMountainValley();
    else {
      const hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), this.material('#92bcae'), 30);
      for (let i = 0; i < 30; i++) {
        const angle = i / 30 * Math.PI * 2;
        dummy.position.set(130 + Math.sin(angle) * (650 + i % 4 * 50), 5, 20 + Math.cos(angle) * 690);
        dummy.scale.set(100 + i % 3 * 25, 90 + i % 5 * 22, 130); dummy.rotation.set(0, i * .8, 0); dummy.updateMatrix(); hills.setMatrixAt(i, dummy.matrix);
      }
      this.stage.add(hills);
    }
    const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: '#eff8f3' }), 48);
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      dummy.position.set(Math.sin(angle) * 750, 160 + i % 4 * 32, Math.cos(angle) * 750);
      dummy.scale.set(60 + i % 3 * 23, 15 + i % 2 * 10, 35); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix);
    }
    this.stage.add(clouds);
    // Trackside flags, bend arrows and a small paddock at the start.
    for (let i = 0; i < 22; i++) {
      const d = i / 22 * track.length, p = track.sample(d, half + 3), g = new THREE.Group();
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
      this.box(g, [.13, 7, .13], [0, 3.5, 0], archMat);
      this.box(g, [1.5, 3.4, .06], [.75, 5.3, 0], this.material(i % 2 ? '#ef92ac' : '#fff1dc'));
      this.stage.add(g);
      if (Math.abs(p.curvature) > .007) {
        const arrow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.5), new THREE.MeshBasicMaterial({ map: this.texture(p.curvature > 0 ? '› › ›' : '‹ ‹ ‹', '#24404d', '#fff4ce'), side: THREE.DoubleSide }));
        const a = track.sample(d, -Math.sign(p.curvature) * (half + 2));
        arrow.position.set(a.x, 3, a.z); arrow.rotation.y = Math.atan2(a.tx, a.tz) + Math.PI; this.stage.add(arrow);
      }
    }
    for (let i = 0; i < 6; i++) {
      const p = track.sample(-60 + i * 17, -half - 15), tent = new THREE.Group();
      tent.position.set(p.x, 0, p.z); tent.rotation.y = Math.atan2(p.tx, p.tz);
      this.box(tent, [8, 3.4, 9], [0, 1.7, 0], this.material('#f7eddf'));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7.1, 3.3, 4), this.material(i % 2 ? '#e88da0' : '#77b9bf'));
      roof.position.y = 4.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true; tent.add(roof);
      this.box(tent, [5, 1.5, .12], [0, 1.8, 4.55], darkMat); this.stage.add(tent);
    }
  }


  // 樱花古境同款山谷：程序化地形围着赛道抬升成环山，赛道附近保持平坦
  private buildMountainValley() {
    // 赛道中心线采样 → 距离场，决定山从哪里开始隆起
    const samples: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 400; i++) { const p = this.track.sample(i / 400 * this.track.length); samples.push({ x: p.x, z: p.z }); }
    const distToTrack = (x: number, z: number) => {
      let m = Infinity;
      for (const p of samples) { const dx = x - p.x, dz = z - p.z, d = dx * dx + dz * dz; if (d < m) m = d; }
      return Math.sqrt(m);
    };
    // 赛道包围盒中心，环山围着它
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of this.track.points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const peaks: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * Math.PI * 2 + 0.3;
      const r = 520 + Math.sin(i * 2.7) * 80;
      peaks.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, 95 + Math.sin(i * 1.9) * 45, 160 + Math.sin(i * 3.3) * 40]);
    }
    const heightAt = (x: number, z: number, d: number) => {
      const rise = THREE.MathUtils.smoothstep(d, 40, 130);
      if (rise <= 0) return 0;
      let h = 0;
      for (const [px, pz, top, w] of peaks) h += top * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (w * w));
      const ridges = Math.sin(x * 0.019 + Math.sin(z * 0.011)) * Math.cos(z * 0.016) + Math.sin(x * 0.043 + z * 0.027) * 0.38;
      h = (h + ridges * 9) * rise;
      h += rise * Math.sin(x * 0.05) * Math.cos(z * 0.06) * 4; // 近处缓丘
      return h;
    };
    const terrain = new THREE.PlaneGeometry(1500, 1500, 232, 212);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(cx, 0, cz);
    const pos = terrain.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i), distToTrack(pos.getX(i), pos.getZ(i))));
    terrain.computeVertexNormals();
    const nor = terrain.attributes.normal;
    const colors: number[] = [];
    const deep = new THREE.Color('#2c493b'), meadow = new THREE.Color('#607858');
    const rock = new THREE.Color('#81817d'), lawn = new THREE.Color('#5d7052');
    const tint = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
      const variation = (Math.sin(x * 0.4) * Math.cos(z * 0.31) + 1) * 0.5;
      tint.copy(deep).lerp(meadow, variation * 0.45 + THREE.MathUtils.clamp(h / 140, 0, 0.3));
      tint.lerp(rock, THREE.MathUtils.smoothstep(1 - nor.getY(i), 0.2, 0.5) * 0.75);
      const d = distToTrack(x, z);
      if (d < 60) tint.lerp(lawn, 0.3);
      colors.push(tint.r, tint.g, tint.b);
    }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const land = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    land.receiveShadow = true;
    this.stage.add(land);

    // 草丛（古境草皮样式），撒在赛道外围的缓坡上
    const blades: number[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.399, dx = Math.cos(angle), dz = Math.sin(angle);
      blades.push(-dz * 0.08, 0, dx * 0.08, dz * 0.08, 0, -dx * 0.08, dx * 0.35, 0.5 + (i % 3) * 0.1, dz * 0.35);
    }
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    grassGeometry.computeVertexNormals();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const plant = new THREE.Object3D();
    for (let i = 0; i < 2600; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 30 + ((i * 7919) % 100) / 100 * 90;
      const x = cx + Math.cos(a) * r * 1.6, z = cz + Math.sin(a) * r * 1.4;
      const d = distToTrack(x, z);
      if (d < 24 || d > 110) continue;
      plant.position.set(x, heightAt(x, z, d) - 0.04, z);
      plant.rotation.y = a;
      plant.scale.setScalar(0.35 + ((i * 104729) % 10) / 10 * 0.9);
      plant.updateMatrix();
      mats.push(plant.matrix.clone());
      cols.push(new THREE.Color(i % 3 ? '#496044' : '#758160'));
    }
    const tufts = new THREE.InstancedMesh(grassGeometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 }), mats.length);
    mats.forEach((m, i) => { tufts.setMatrixAt(i, m); tufts.setColorAt(i, cols[i]); });
    this.stage.add(tufts);
  }

  // 樱花古境风格的路旁景物：石板广场、青瓦院墙、红灯笼、水塘、落瓣
  private buildQixiaDecor() {
    const half = this.track.width / 2;
    const jade = ['#34454b', '#475b61', '#53656b', '#3d525c'];
    const stone = this.material('#9a939a', .9);
    const red = this.material('#98534e', .72);
    const wood = this.material('#593c3c', .8);

    // ---- 起终点两侧：石板广场（四色石板错缝，古境庭院同款）----
    const tiles: Array<{ m: THREE.Matrix4; c: THREE.Color }> = [];
    const dummy = new THREE.Object3D();
    const tileTones = ['#9a9397', '#a69e9e', '#a29d9a', '#908c97'].map(c => new THREE.Color(c));
    for (const sideSign of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 14; col++) {
          const d = -32 + col * 4.6;
          const p = this.track.sample(d, sideSign * (half + 2.4 + row * 4.55));
          dummy.position.set(p.x, 0.16, p.z);
          dummy.rotation.set(0, Math.atan2(p.tx, p.tz), 0);
          dummy.scale.set(4.5, 0.32, 4.5);
          dummy.updateMatrix();
          tiles.push({ m: dummy.matrix.clone(), c: tileTones[(row * 11 + col * 7) % 4] });
        }
      }
    }
    const tileMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .88 }), tiles.length);
    tiles.forEach((t, i) => { tileMesh.setMatrixAt(i, t.m); tileMesh.setColorAt(i, t.c); });
    tileMesh.receiveShadow = true;
    this.stage.add(tileMesh);

    // ---- 院墙段：石基 + 檐柱 + 青瓦压顶（放在弯道外侧）----
    const wallSpots = [0.06, 0.14, 0.22, 0.38, 0.47, 0.63, 0.8, 0.9];
    for (const t of wallSpots) {
      const d = t * this.track.length;
      const curvature = this.track.sample(d).curvature;
      const side = Math.sign(curvature) || 1; // 弯道外侧
      const p = this.track.sample(d, side * (half + 16));
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
      const base = new THREE.Mesh(new THREE.BoxGeometry(34, 2.6, 0.9), this.material('#788478', .9));
      base.position.y = 1.3; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(34.6, 0.55, 1.5), this.material(jade[1], .6));
      cap.position.y = 2.85; cap.castShadow = true; g.add(cap);
      for (let i = -3; i <= 3; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 1.1), stone);
        post.position.set(i * 4.8, 1.7, 0); post.castShadow = true; g.add(post);
        const postCap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.5), this.material(jade[0], .6));
        postCap.position.set(i * 4.8, 3.6, 0); g.add(postCap);
      }
      this.stage.add(g);
    }

    // ---- 红柱灯笼沿路 ----
    const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe0bd', emissive: '#ffc292', emissiveIntensity: 1.1, roughness: .7 });
    const lampCount = Math.floor(this.track.length / 130);
    for (let i = 0; i < lampCount; i++) {
      const d = i / lampCount * this.track.length;
      const side = i % 2 ? 1 : -1;
      const p = this.track.sample(d, side * (half + 5.5));
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 6.4, 10), red);
      post.position.y = 3.2; post.castShadow = true; g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.22), wood);
      arm.position.set(0.6, 6.2, 0); g.add(arm);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.15, 8), lampMat);
      lamp.position.set(1.15, 5.5, 0); lamp.castShadow = true; g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 8), this.material(jade[0], .6));
      cap.position.set(1.15, 6.15, 0); g.add(cap);
      this.stage.add(g);
    }

    // ---- 两座凉亭：石台 + 红柱 + 青瓦攒尖顶 ----
    for (const [t, s] of [[0.3, 1], [0.68, -1]] as const) {
      const p = this.track.sample(t * this.track.length, s * (half + 13));
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 1, 8), stone);
      floor.position.y = 0.5; floor.castShadow = true; floor.receiveShadow = true; g.add(floor);
      for (const [px, pz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]] as const) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 7.5, 10), red);
        pillar.position.set(px, 4.7, pz); pillar.castShadow = true; g.add(pillar);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 4.4, 4), this.material(jade[1], .55));
      roof.position.y = 10.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), this.material('#ad8d73', .5));
      finial.position.y = 12.8; g.add(finial);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 1.6), wood);
      bench.position.y = 1.4; g.add(bench);
      this.stage.add(g);
    }

    // ---- 水塘 + 睡莲（古境水色）----
    const waterMat = new THREE.MeshStandardMaterial({ color: '#607082', roughness: .22, metalness: .5, transparent: true, opacity: .95 });
    for (const [t, s] of [[0.18, 1], [0.55, -1]] as const) {
      const p = this.track.sample(t * this.track.length, s * (half + 30));
      const water = new THREE.Mesh(new THREE.CircleGeometry(14, 48), waterMat);
      water.rotation.x = -Math.PI / 2; water.position.set(p.x, 0.08, p.z);
      this.stage.add(water);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 + (i % 3) * 0.4, 0), this.material('#6d6a62', .9));
        rock.position.set(p.x + Math.cos(a) * 14.6, 0.5, p.z + Math.sin(a) * 14.6);
        rock.rotation.set(i * 0.7, i * 1.3, 0); rock.castShadow = true; this.stage.add(rock);
      }
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, r = 3 + (i % 4) * 2.6;
        const pad = new THREE.Mesh(new THREE.CircleGeometry(1.3, 9), this.material(i % 3 ? '#496b4d' : '#6f8151', .85));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(p.x + Math.cos(a) * r, 0.16, p.z + Math.sin(a) * r);
        this.stage.add(pad);
        if (i % 3 === 0) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), this.material('#c39583', .6));
          bloom.position.copy(pad.position).setY(0.5);
          this.stage.add(bloom);
        }
      }
    }

    // ---- 路肩落瓣（真实花瓣几何，古境同款五色）----
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, -0.55);
    petalShape.bezierCurveTo(-0.55, -0.18, -0.5, 0.55, -0.13, 0.48);
    petalShape.lineTo(0, 0.32); petalShape.lineTo(0.13, 0.48);
    petalShape.bezierCurveTo(0.5, 0.55, 0.55, -0.18, 0, -0.55);
    const petalGeo = new THREE.ShapeGeometry(petalShape, 4);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide, emissive: '#b86588', emissiveIntensity: .14 });
    const petalTones = ['#fff1f1', '#f3cdda', '#edb8cc', '#ffe9ed', '#e2b0c4'].map(c => new THREE.Color(c));
    const petals = Array.from({ length: 700 }, (_, i) => {
      const d = (i * 2.189) % 1 * this.track.length;
      const side = i % 2 ? 1 : -1;
      const p = this.track.sample(d, side * (half + 2.2 + (i % 17) * 1.15));
      dummy.position.set(p.x, 0.28, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, i * 1.7);
      dummy.scale.setScalar(1.1 + (i % 5) * 0.35);
      dummy.updateMatrix();
      return { m: dummy.matrix.clone(), c: petalTones[i % 5] };
    });
    const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petals.length);
    petals.forEach((v, i) => { petalMesh.setMatrixAt(i, v.m); petalMesh.setColorAt(i, v.c); });
    this.stage.add(petalMesh);
  }

  private buildTrees(coast: boolean) {
    if (!coast) {
      // 樱花公路：古境同款樱花树（game 密度档，约 750 朵/棵）
      const count = Math.floor(this.track.length / 26);
      const specs = Array.from({ length: count }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const p = this.track.sample(i / count * this.track.length, side * (this.track.width / 2 + 9 + (Math.sin(i * 78.23) + 1) * 5));
        return { x: p.x, z: p.z, seed: i * 13 + 7, scale: 2.2 + Math.sin(i * 32.1) * 0.45 };
      });
      this.stage.add(buildSakuraGrove(specs));
      return;
    }
    const count = Math.floor(this.track.length / 13) * 2;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.23, .48, 5, 6), this.material('#967e71'), count);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.material('#f3abc2'), count * 3);
    const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: '#557e67', transparent: true, opacity: .22, depthWrite: false }), count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const distance = Math.floor(i / 2) * 13, side = i % 2 ? 1 : -1;
      const p = this.track.sample(distance, side * (this.track.width / 2 + 9 + (Math.sin(i * 78.23) + 1) * 7));
      const size = .8 + (Math.sin(i * 32.1) + 1) * .28;
      dummy.position.set(p.x, 2.5 * size, p.z); dummy.scale.setScalar(size); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 3; j++) {
        dummy.position.set(p.x + Math.sin(j * 2.1 + i) * 2, (6 + (j === 0 ? 1 : 0)) * size, p.z + Math.cos(j * 2.1 + i) * 1.6);
        dummy.scale.set(3.4 * size, 2.6 * size, 3.3 * size); dummy.updateMatrix(); crowns.setMatrixAt(i * 3 + j, dummy.matrix);
        crowns.setColorAt(i * 3 + j, new THREE.Color(coast ? ['#75b58d', '#95c49e', '#bfd1a0'][j] : ['#f3acc6', '#ffd0d6', '#ef97b7'][j]));
      }
      dummy.position.set(p.x + 1.4, .015, p.z - 1); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(4.4 * size, 3 * size, 1); dummy.updateMatrix(); shadow.setMatrixAt(i, dummy.matrix);
    }
    trunks.castShadow = true; crowns.castShadow = true;
    this.stage.add(trunks, crowns, shadow);
  }
  private buildCar(racer: Racer): CarVisual {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body); this.stage.add(group);
    const paint = this.material(racer.color, .32), black = this.material('#263642', .63), white = this.material('#fff7eb', .34);
    const glass = new THREE.MeshStandardMaterial({ color: '#244e61', roughness: .18, metalness: .5 });
    const wheels: THREE.Mesh[] = [], jets: THREE.Mesh[] = [];
    this.box(body, [2.05, .23, 3.95], [0, .53, 0], black);
    this.hull(body, [-1.12,.57,-1.86, 1.12,.57,-1.86, 1,.57,1.98, -1,.57,1.98], [-1.04,1.15,-1.8, 1.04,1.15,-1.8, .88,.88,1.88, -.88,.88,1.88], paint);
    const hood = this.box(body, [1.8, .1, 1.31], [0, 1.02, 1.16], paint); hood.rotation.x = .07;
    const nose = this.box(body, [2.12, .1, .3], [0, .55, 1.93], black); nose.rotation.x = .1;
    const stripe = this.box(body, [.29, .018, 1.34], [0, 1.085, 1.16], white); stripe.rotation.x = .07;
    this.hull(body, [-.81,1.09,-1.08, .81,1.09,-1.08, .82,1.09,.63, -.82,1.09,.63], [-.64,1.7,-.73, .64,1.7,-.73, .64,1.7,.03, -.64,1.7,.03], glass);
    this.box(body, [1.33, .10, .79], [0, 1.73, -.34], paint);
    this.box(body, [.25, .02, .79], [0, 1.79, -.34], white);
    this.box(body, [2.65, .13, .65], [0, 1.56, -1.78], black);
    for (const side of [-1, 1]) {
      this.box(body, [.13, .5, .18], [side * .82, 1.3, -1.73], black);
      this.box(body, [.7, .17, .06], [side * .7, 1.02, -1.83], new THREE.MeshBasicMaterial({ color: '#ff6e64' }));
      const light = this.box(body, [.48, .11, .08], [side * .64, .82, 1.94], new THREE.MeshBasicMaterial({ color: '#fff5c7' })); light.rotation.z = side * .16;
      this.box(body, [.22, .15, 2.8], [side * 1.21, .56, -.1], black);
      for (const z of [-1.2, 1.23]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.49, .49, .37, 12), black);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.12, .52, z); wheel.castShadow = true; body.add(wheel); wheels.push(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .39, 8), white); wheel.add(hub);
      }
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .25, 10), black); exhaust.rotation.x = Math.PI / 2; exhaust.position.set(side * .65, .6, -2.08); body.add(exhaust);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(.26, 2.5, 8), new THREE.MeshBasicMaterial({ color: '#62e5ff', transparent: true, opacity: .9 }));
      jet.rotation.x = -Math.PI / 2; jet.position.set(side * .65, .6, -3.25); jet.visible = false; body.add(jet); jets.push(jet);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#172c3a', transparent: true, opacity: .14, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.5, 2.4, 1); shadow.position.y = .11; group.add(shadow);
    let label: THREE.Sprite | undefined;
    if (racer.id > 0) {
      label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(racer.name, '#243f4dcc', '#ffffff', 192, 64), depthTest: true }));
      label.scale.set(3.5, 1.16, 1); label.position.y = 3.8; group.add(label);
    }
    return { group, body, wheels, jets, shadow, label };
  }
  private emit(racer: Racer, boosted: boolean) {
    const p = this.track.sample(racer.distance - 2, racer.offset), particle = this.particles[this.particleCursor++ % this.particles.length];
    const side = this.particleCursor % 2 ? 1 : -1;
    particle.mesh.position.set(p.x + p.nx * side, .4, p.z + p.nz * side);
    particle.velocity.set(-p.tx * 6 + p.nx * side * 2, boosted ? .5 : 2, -p.tz * 6 + p.nz * side * 2);
    particle.life = particle.maxLife = boosted ? .3 : .65;
    const mat = particle.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(boosted ? '#6ae8ff' : racer.driftTime > 1.35 ? '#fbc869' : '#bceaf9');
    particle.mesh.visible = true;
  }
  render(race: Race, dt: number, lookBack = false) {
    this.elapsed += dt;
    const driving = race.phase === 'racing' || race.phase === 'countdown';
    const garage = race.phase === 'garage';
    const width = this.host.clientWidth, height = this.host.clientHeight;
    const mobileGarage = garage && width <= 760 && height > 560;
    const viewHeight = mobileGarage ? Math.min(height, 320) : height;
    this.renderer.setViewport(0, height - viewHeight, width, viewHeight);
    this.camera.aspect = width / viewHeight;
    if (mobileGarage) this.camera.setViewOffset(width, viewHeight, -width * .16, -viewHeight * .08, width, viewHeight);
    else this.camera.clearViewOffset();
    const p = race.player;
    this.particleClock += driving ? dt : 0;
    for (let i = 0; i < this.cars.length; i++) {
      const racer = race.racers[i], visual = this.cars[i];
      const sample = this.track.sample(racer.distance, racer.offset);
      visual.group.position.set(sample.x, .10, sample.z);
      visual.group.rotation.y = Math.atan2(sample.tx, sample.tz);
      visual.body.rotation.y = racer.yaw;
      visual.body.rotation.z = -racer.lateral * .004;
      if (driving) for (const wheel of visual.wheels) wheel.rotation.x += racer.speed * dt * 1.8;
      const boosted = racer.boostTime > 0 || racer.miniTime > 0;
      for (const jet of visual.jets) {
        jet.visible = boosted; jet.scale.y = (racer.boostTime > 0 ? 1.2 : .65) * (1 + Math.sin(this.elapsed * 40) * .14);
      }
      if (visual.label) visual.label.visible = !garage && i !== 0;
      if (driving && !this.reducedMotion && this.particleClock > .025 && (racer.drifting || boosted)) this.emit(racer, boosted);
    }
    if (this.particleClock > .025) this.particleClock = 0;
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      if (driving) { particle.life -= dt; particle.mesh.position.addScaledVector(particle.velocity, dt); }
      particle.mesh.visible = particle.life > 0;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, particle.life / particle.maxLife);
      particle.mesh.scale.setScalar(1 + (1 - particle.life / particle.maxLife) * 2);
    }
    const player = this.track.sample(p.distance, p.offset);
    const target = new THREE.Vector3(), lookAt = new THREE.Vector3();
    if (garage) {
      // Front three-quarter showroom view, with the grid and start gate in the same world.
      const angle = this.reducedMotion ? .65 : .65 + Math.sin(this.elapsed * .17) * .10;
      target.set(player.x + player.nx * Math.sin(angle) * 10 + player.tx * 7, 4.5, player.z + player.nz * Math.sin(angle) * 10 + player.tz * 7);
      lookAt.set(player.x, 1, player.z);
    } else {
      const direction = lookBack ? 1 : -1;
      const extra = !this.reducedMotion && p.boostTime > 0 ? 1.8 : 0;
      target.set(player.x + player.tx * direction * (10.5 + extra), 5.7, player.z + player.tz * direction * (10.5 + extra));
      const ahead = this.track.sample(p.distance + (lookBack ? -12 : 17), p.offset * .75);
      lookAt.set(ahead.x, 1.4, ahead.z);
    }
    if (!this.cameraReady || lookBack) { this.follow.copy(target); this.look.copy(lookAt); this.cameraReady = true; }
    else { this.follow.lerp(target, 1 - Math.exp(-dt * 10)); this.look.lerp(lookAt, 1 - Math.exp(-dt * 9)); }
    this.camera.position.copy(this.follow); this.camera.lookAt(this.look);
    const targetFov = garage ? 47 : (this.camera.aspect < 1 ? 76 : 62) + (this.reducedMotion ? 0 : p.speed / 62 * 6 + (p.boostTime > 0 ? 5 : 0));
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5); this.camera.updateProjectionMatrix();
    this.sun.position.set(player.x - 70, 110, player.z + 45); this.sun.target.position.set(player.x, 0, player.z);
    this.renderer.render(this.scene, this.camera);
  }
  drawMap(canvas: HTMLCanvasElement, race: Race) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height, points = this.track.points;
    ctx.clearRect(0, 0, w, h);
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
    const scale = Math.min((w - 36) / (maxX - minX), (h - 36) / (maxZ - minZ));
    const px = (x: number) => (x - (minX + maxX) / 2) * scale + w / 2;
    const py = (z: number) => h / 2 - (z - (minZ + maxZ) / 2) * scale;
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(px(p.x), py(p.z)) : ctx.moveTo(px(p.x), py(p.z))); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#28475755'; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = '#ffffffd9'; ctx.lineWidth = 5; ctx.stroke();
    const start = this.track.sample(0); ctx.fillStyle = '#284757'; ctx.fillRect(px(start.x) - 4, py(start.z) - 4, 8, 8);
    for (const r of [...race.racers].reverse()) {
      const p = this.track.sample(wrap(r.distance, this.track.length));
      ctx.beginPath(); ctx.arc(px(p.x), py(p.z), r.id === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = r.color; ctx.fill(); ctx.lineWidth = r.id === 0 ? 2.5 : 1.2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }
  private disposeStage() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.stage.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        if (object instanceof THREE.Mesh) geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.textures.clear();
    this.scene.remove(this.stage);
  }
  dispose() { this.observer.disconnect(); this.disposeStage(); this.sun.shadow.dispose(); this.renderer.dispose(); }
}

// Audio is synthesized locally and is only unlocked by a user gesture.
export class RaceAudio {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  enabled = false;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        if (!this.context) {
          this.context = new AudioContext(); this.oscillator = this.context.createOscillator(); this.gain = this.context.createGain(); this.filter = this.context.createBiquadFilter();
          this.oscillator.type = 'sawtooth'; this.filter.type = 'lowpass'; this.filter.frequency.value = 550;
          this.gain.gain.value = 0; this.oscillator.connect(this.filter).connect(this.gain).connect(this.context.destination); this.oscillator.start();
        }
        await this.context.resume();
      } catch { this.enabled = false; }
    }
    return this.enabled;
  }
  update(race: Race) {
    if (!this.context || !this.oscillator || !this.gain || !this.filter) return;
    const r = race.player, active = this.enabled && race.phase === 'racing';
    this.gain.gain.setTargetAtTime(active ? .022 : 0, this.context.currentTime, .08);
    this.oscillator.frequency.setTargetAtTime(38 + (r.speed % 17) * 3 + r.speed * .7, this.context.currentTime, .09);
    this.filter.frequency.setTargetAtTime(r.drifting ? 1500 : r.boostTime > 0 ? 1100 : 550, this.context.currentTime, .1);
  }
  beep(frequency: number) {
    if (!this.enabled || !this.context) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime;
    osc.frequency.value = frequency; gain.gain.setValueAtTime(.06, now); gain.gain.exponentialRampToValueAtTime(.001, now + .2);
    osc.connect(gain).connect(this.context.destination); osc.start(); osc.stop(now + .21);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  dispose() { this.oscillator?.stop(); void this.context?.close(); }
}
