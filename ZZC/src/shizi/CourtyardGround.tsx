import { useEffect, useMemo } from 'react'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { blossomRandom as random } from './sakuraGrove'

function grainTexture(grass: boolean) {
  const size = 128, bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4
    const grain = random(x * 31 + y * 89 + 17)
    const patch = Math.sin(x * 0.14) * Math.cos(y * 0.11)
    const base = grass ? [90, 106, 73] : [242, 239, 230]
    for (let channel = 0; channel < 3; channel++) bytes[index + channel] = base[channel] + (grain - 0.5) * (grass ? 17 : 22) + patch * (grass ? 6 : 2)
    bytes[index + 3] = 255
  }
  const texture = new T.DataTexture(bytes, size, size)
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.magFilter = T.LinearFilter
  texture.minFilter = T.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = T.SRGBColorSpace
  texture.repeat.set(grass ? 8 : 3, grass ? 8 : 3)
  texture.needsUpdate = true
  return texture
}

function tint(geometry: T.BufferGeometry, color: T.Color) {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let index = 0; index < colors.length; index += 3) colors.set([color.r, color.g, color.b], index)
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  return geometry
}

function buildGround() {
  const group = new T.Group()
  const grass = grainTexture(true), stone = grainTexture(false)
  const grassMaterial = new T.MeshStandardMaterial({ map: grass, roughness: 1 })
  const pavingMaterial = new T.MeshStandardMaterial({ vertexColors: true, map: stone, roughness: 0.94 })
  const groutMaterial = new T.MeshStandardMaterial({ color: '#59554a', roughness: 1 })
  const stageMaterial = new T.MeshStandardMaterial({ color: '#8b7c66', map: stone, roughness: 0.9 })
  const bronzeMaterial = new T.MeshStandardMaterial({ color: '#b5a070', roughness: 0.56, metalness: 0.45 })
  const add = (geometry: T.BufferGeometry, material: T.Material, y = 0) => {
    const mesh = new T.Mesh(geometry, material)
    mesh.position.y = y
    mesh.receiveShadow = true
    mesh.raycast = () => {}
    group.add(mesh)
    return mesh
  }
  add(new T.CircleGeometry(11, 80).rotateX(-Math.PI / 2), grassMaterial)
  add(new T.CylinderGeometry(2.30, 2.32, 0.035, 80), groutMaterial, 0.002)

  // An annulus of individual sandstone blocks leaves narrow, quiet mortar joints.
  const pavers: T.BufferGeometry[] = []
  for (let index = 0; index < 32; index++) {
    const angle = index / 32 * Math.PI * 2
    const geometry = new T.RingGeometry(1.82, 2.28, 3, 1, angle + 0.006, Math.PI * 2 / 32 - 0.012)
    geometry.rotateX(-Math.PI / 2).translate(0, 0.024 + random(index + 45) * 0.002, 0)
    const color = new T.Color('#aaa08b').multiplyScalar(0.93 + random(index + 23) * 0.12)
    pavers.push(tint(geometry, color))
  }
  add(mergeGeometries(pavers)!, pavingMaterial)
  pavers.forEach(geometry => geometry.dispose())

  // Keep the original 0.15 standing height so the lion's feet stay supported.
  add(new T.CylinderGeometry(1.72, 1.85, 0.14, 80), stageMaterial, 0.07).castShadow = true
  add(new T.CircleGeometry(1.715, 80).rotateX(-Math.PI / 2), stageMaterial, 0.145)
  add(new T.RingGeometry(1.48, 1.51, 80).rotateX(-Math.PI / 2), bronzeMaterial, 0.147)
  add(new T.TorusGeometry(1.75, 0.012, 5, 80).rotateX(Math.PI / 2), bronzeMaterial, 0.11)

  const steps: T.BufferGeometry[] = []
  for (let index = 0; index < 7; index++) {
    const shape = new T.Shape()
    for (let corner = 0; corner < 9; corner++) {
      const angle = corner / 9 * Math.PI * 2
      const radius = 0.31 + random(index * 83 + corner * 11) * 0.045
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * 0.75
      if (corner === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()
    const geometry = new T.ExtrudeGeometry(shape, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.024, bevelSegments: 2, steps: 1 })
    // Extrusion is local +Z; this rotation lays each slab horizontally.
    geometry.rotateZ(index * 0.45).rotateX(-Math.PI / 2)
    geometry.translate(Math.sin(index * 1.8) * 0.18, 0.018, 2.65 + index * 0.57)
    const color = new T.Color(index % 3 ? '#aaa798' : '#92978a')
    steps.push(tint(geometry, color))
  }
  add(mergeGeometries(steps)!, pavingMaterial)
  steps.forEach(geometry => geometry.dispose())

  // Fine gravel sits beside the path, rather than filling the central stage.
  const pebbleGeometry = new T.IcosahedronGeometry(1, 0)
  const pebbleMaterial = new T.MeshStandardMaterial({ color: '#929181', roughness: 1 })
  const pebbles = new T.InstancedMesh(pebbleGeometry, pebbleMaterial, 110)
  const dummy = new T.Object3D()
  for (let index = 0; index < 110; index++) {
    const z = 2.45 + random(index * 13 + 5) * 4.4
    const side = index % 2 ? 1 : -1
    const radius = 0.018 + random(index * 17) * 0.028
    dummy.position.set(side * (0.47 + random(index * 29) * 0.24), radius * 0.3, z)
    dummy.rotation.set(random(index * 7), random(index * 11) * 6, 0)
    dummy.scale.set(radius * 1.35, radius * 0.55, radius)
    dummy.updateMatrix()
    pebbles.setMatrixAt(index, dummy.matrix)
    pebbles.setColorAt(index, new T.Color(index % 3 ? '#9e9a8a' : '#777c6b'))
  }
  pebbles.receiveShadow = true
  pebbles.raycast = () => {}
  pebbles.computeBoundingSphere()
  group.add(pebbles)
  return {
    group,
    dispose() {
      group.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose() })
      pebbles.dispose()
      for (const material of [grassMaterial, pavingMaterial, groutMaterial, stageMaterial, bronzeMaterial, pebbleMaterial]) material.dispose()
      grass.dispose(); stone.dispose()
    },
  }
}

export default function CourtyardGround() {
  const ground = useMemo(buildGround, [])
  useEffect(() => () => ground.dispose(), [ground])
  return <primitive object={ground.group} />
}
