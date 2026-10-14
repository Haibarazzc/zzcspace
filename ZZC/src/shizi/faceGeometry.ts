import * as T from 'three'

export function createClosedEyeGeometry() {
  const points = Array.from({ length: 25 }, (_, i) => {
    const u = i / 24, x = (u * 2 - 1) * 0.102
    const y = -0.014 + Math.sin(u * Math.PI) * 0.026
    const z = Math.sqrt(1 - (x / 0.135) ** 2 - (y / 0.161) ** 2) * 0.079 + 0.009
    return new T.Vector3(x, y, z)
  })
  return new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, 0.0035, 6, false)
}

export function createBlinkGeometry() {
  const geometry = new T.BufferGeometry()
  const segments = 32, rows = 8
  geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array((segments + 1) * (rows + 1) * 3), 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array((segments + 1) * (rows + 1) * 4), 4))
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = (i + 1) * (rows + 1) + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  geometry.setIndex(indices)
  updateBlinkGeometry(geometry, 1)
  return geometry
}

export function updateBlinkGeometry(geometry: T.BufferGeometry, closure: number) {
  const position = geometry.getAttribute('position')
  const color = geometry.getAttribute('color')
  for (let i = 0; i <= 32; i++) {
    const angle = i / 32 * Math.PI
    const x = Math.cos(angle) * 0.135, height = Math.sin(angle) * 0.161
    for (let j = 0; j <= 8; j++) {
      const y = height * (1 - 2 * closure * j / 8)
      const z = Math.sqrt(Math.max(0, 1 - (x / 0.135) ** 2 - (y / 0.161) ** 2)) * 0.079 + 0.005
      position.setXYZ(i * 9 + j, x, y, z)
      const radius = Math.hypot(x / 0.135, y / 0.161)
      color.setXYZW(i * 9 + j, 1, 1, 1, 1 - T.MathUtils.smoothstep(radius, 0.82, 1))
    }
  }
  position.needsUpdate = true
  color.needsUpdate = true
  geometry.computeVertexNormals()
}

export function createEyeGeometry() {
  const geometry = new T.SphereGeometry(1, 48, 32)
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const center = new T.Color('#492a20')
  const edge = new T.Color('#865337')
  const tint = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(positions.getX(i), positions.getY(i))
    tint.copy(center).lerp(edge, T.MathUtils.smoothstep(radius, 0.25, 1))
    colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return geometry
}

export function createTeethGeometry() {
  // A tapered ribbon with an elliptical cross section follows the mouth roof.
  const segments = 48, sides = 12
  const vertices: number[] = [], indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments * 2 - 1
    const taper = Math.sqrt(1 - u * u)
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2
      vertices.push(
        u * 0.28,
        1.502 + u * u * 0.014 + Math.sin(angle) * 0.017 * taper,
        0.783 - u * u * 0.105 + Math.cos(angle) * 0.010 * taper,
      )
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = (i + 1) * sides + j
      const c = i * sides + (j + 1) % sides, d = (i + 1) * sides + (j + 1) % sides
      indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createEyelidGeometry() {
  const segments = 32, rows = 4
  const vertices: number[] = [], indices: number[] = []
  const colors: number[] = []
  const inner = new T.Color('#ad8c65'), outer = new T.Color('#d8c49f'), tint = new T.Color()
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI
    const arch = Math.sin(angle)
    for (let j = 0; j <= rows; j++) {
      const across = j / rows
      vertices.push(
        Math.cos(angle) * (0.111 + across * arch * 0.026),
        arch * (0.126 + across * arch * 0.017),
        arch * (0.018 - across * 0.042) + Math.sin(across * Math.PI) * arch * 0.004,
      )
      tint.copy(inner).lerp(outer, T.MathUtils.smoothstep(across, 0, 0.85))
      colors.push(tint.r, tint.g, tint.b)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = (i + 1) * (rows + 1) + j
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createTongueGeometry() {
  const geometry = new T.SphereGeometry(1, 48, 28)
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const root = new T.Color('#aa6062'), tip = new T.Color('#eda19c'), tint = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const front = T.MathUtils.smoothstep(z, -0.6, 0.65)
    const width = 0.68 + 0.32 * T.MathUtils.smoothstep(z, -0.7, 0.4)
    const groove = y > 0 ? Math.exp(-((x / 0.12) ** 2)) * front * 0.004 : 0
    const lift = 0.033 * (1 - front) + 0.017 * front
    positions.setXYZ(i, x * 0.225 * width, y * 0.045 + lift - groove, z * 0.19)
    tint.copy(root).lerp(tip, front)
    colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
