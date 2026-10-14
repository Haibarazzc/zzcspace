import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import useEmblemTexture from './useEmblemTexture'
import { createBlinkGeometry, createClosedEyeGeometry, updateBlinkGeometry, createEyeGeometry, createEyelidGeometry, createTeethGeometry, createTongueGeometry } from './faceGeometry'
import { addSmileMorph, animateLionRig, BODY_PIVOT, CHEER_DURATION, CHEER_PEAK_TIME, createLionRig, getPetAmount, getSmileAmount, HEAD_PIVOT, PET_DURATION, PET_PEAK_TIME } from './lionMotion'
import { bindLionGaze, createLionGaze, updateLionGaze, type LionGaze } from './lionGaze'
import type { PoseId } from './data'

// Vite resolves the model beside its chunk, including under /portfolio/shizi/.
import modelUrl from './shixiaoxin-30k.glb?url'
const LION_GROUND = 0.15

// Coordinates are local to the normalized, three-unit-high model.
export function lionPart({ x, y, z }: { x: number; y: number; z: number }) {
  if (y > 2.05 && Math.abs(x) < 0.27 && z > 0.52) return 1
  if (y > 1.14) return z > 0.36 && Math.abs(x) < 0.8 && y < 2.4 ? 2 : 0
  if (x > 0.64 && z < -0.25 && y > 0.22) return 5
  if (y > 0.46 && Math.abs(x) < 0.38 && z > 0.14) return 3
  return 4
}

export function isPetPoint({ x, y, z }: { x: number; y: number; z: number }) {
  return (y > 2.04 && Math.abs(x) < 0.34 && z > 0.40)
    || (y > 2.55 && Math.abs(x) < 0.72 && z > -0.10)
}

function Eye({ x, blink, smile, gaze }: { x: number; blink: RefObject<number>; smile: RefObject<number>; gaze: LionGaze }) {
  const geometry = useMemo(createEyeGeometry, [])
  const eyelid = useMemo(createEyelidGeometry, [])
  const lidGeometry = useMemo(createBlinkGeometry, [])
  const closedGeometry = useMemo(createClosedEyeGeometry, [])
  const iris = useRef<T.Group>(null)
  const eyeball = useRef<T.Group>(null)
  const lid = useRef<T.Mesh>(null)
  const crease = useRef<T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>(null)
  const lastBlink = useRef(-1)
  const lastSmile = useRef(-1)
  useEffect(() => () => { geometry.dispose(); eyelid.dispose(); lidGeometry.dispose(); closedGeometry.dispose() }, [geometry, eyelid, lidGeometry, closedGeometry])
  useFrame(() => {
    const joy = smile.current
    const closure = 1 - (1 - blink.current) * (1 - joy * 0.96)
    // Rotate inside the fixed ellipsoid scale, keeping the eye socket outline.
    if (iris.current) iris.current.rotation.set(-gaze.eyes.y * 0.12 * (1 - closure), gaze.eyes.x * 0.16 * (1 - closure), 0)
    if (closure === lastBlink.current && joy === lastSmile.current) return
    lastBlink.current = closure
    lastSmile.current = joy
    if (eyeball.current) {
      eyeball.current.scale.y = 0.13 * (1 - closure * 0.95)
    }
    if (lid.current) lid.current.visible = closure > 0.002
    if (crease.current) {
      crease.current.visible = closure > 0.70
      crease.current.material.opacity = T.MathUtils.smoothstep(closure, 0.70, 0.94)
    }
    if (closure > 0.002) updateBlinkGeometry(lidGeometry, closure)
  })
  return (
    <group position={[x, 1.8, 0.556]} rotation={[0, Math.sign(x) * 0.15, 0]}>
      <group ref={eyeball} scale={[0.109, 0.13, 0.066]}>
        <group ref={iris}>
          <mesh geometry={geometry} castShadow>
            <meshPhysicalMaterial vertexColors roughness={0.32} clearcoat={0.35} clearcoatRoughness={0.24} specularIntensity={0.65} />
          </mesh>
          <mesh position={[-0.028 / 0.109, 0.039 / 0.13, 0.060 / 0.066]} scale={[0.014 / 0.109, 0.018 / 0.13, 0.005 / 0.066]}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshBasicMaterial color="#fff4db" />
          </mesh>
          <mesh position={[0.032 / 0.109, -0.029 / 0.13, 0.061 / 0.066]} scale={[0.005 / 0.109, 0.007 / 0.13, 0.003 / 0.066]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#dab990" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        </group>
      </group>
      <mesh geometry={eyelid} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh ref={lid} geometry={lidGeometry} visible={false} frustumCulled={false}>
        <meshPhysicalMaterial color="#fff1d7" vertexColors transparent depthWrite={false} roughness={0.5} metalness={0.02} clearcoat={0.18} clearcoatRoughness={0.5} side={T.DoubleSide} />
      </mesh>
      <mesh ref={crease} geometry={closedGeometry} visible={false}>
        <meshStandardMaterial color="#79563d" roughness={0.75} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

function FaceDetails({ blink, smile, gaze }: { blink: RefObject<number>; smile: RefObject<number>; gaze: LionGaze }) {
  const teeth = useMemo(() => addSmileMorph(createTeethGeometry()), [])
  const tongue = useMemo(() => addSmileMorph(createTongueGeometry(), [0, 1.285, 0.45]), [])
  const teethMesh = useRef<T.Mesh>(null)
  const tongueMesh = useRef<T.Mesh>(null)
  useEffect(() => () => { teeth.dispose(); tongue.dispose() }, [teeth, tongue])
  useFrame(() => {
    if (teethMesh.current?.morphTargetInfluences) teethMesh.current.morphTargetInfluences[0] = smile.current
    if (tongueMesh.current?.morphTargetInfluences) tongueMesh.current.morphTargetInfluences[0] = smile.current
  })
  return (
    <group>
      <Eye x={-0.38} blink={blink} smile={smile} gaze={gaze} />
      <Eye x={0.36} blink={blink} smile={smile} gaze={gaze} />
      <mesh position={[0, 1.655, 0.895]} scale={[0.115, 0.06, 0.05]} castShadow>
        <sphereGeometry args={[1, 40, 24]} />
        <meshPhysicalMaterial color="#6b3827" roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.3} />
      </mesh>
      <mesh ref={teethMesh} geometry={teeth} onUpdate={mesh => mesh.updateMorphTargets()}>
        <meshStandardMaterial color="#fff5e4" roughness={0.58} />
      </mesh>
      <mesh ref={tongueMesh} geometry={tongue} position={[0, 1.285, 0.45]} onUpdate={mesh => mesh.updateMorphTargets()}>
        <meshPhysicalMaterial vertexColors roughness={0.58} clearcoat={0.08} clearcoatRoughness={0.5} />
      </mesh>
    </group>
  )
}

export default function LionModel({ pose, reduced, animated, cheerRevision, petRevision, photoPose, onPet, onSelect, onReady }: {
  pose: PoseId
  reduced: boolean
  animated: boolean
  cheerRevision: number
  petRevision: number
  photoPose: PoseId | null
  onPet: () => void
  onSelect: (id: number) => void
  onReady: () => void
}) {
  const { nodes } = useGLTF(modelUrl)
  const { gl } = useThree()
  const source = nodes.Shixiaoxin as T.Mesh<T.BufferGeometry>
  const texture = useEmblemTexture()
  const rig = useMemo(() => createLionRig(source.geometry), [source])
  const elapsed = useRef(0)
  const reactionAt = useRef(-100)
  const cheerAt = useRef(-100)
  const cheerQueued = useRef(false)
  const petAt = useRef(-100)
  const petQueued = useRef(false)
  const seenCheerRevision = useRef(0)
  const seenPetRevision = useRef(0)
  const [reducedPetActive, setReducedPetActive] = useState(false)
  const blink = useRef(0)
  const smile = useRef(0)
  const gaze = useMemo(createLionGaze, [])
  const emblem = useMemo(() => new DecalGeometry(
    new T.Mesh(source.geometry), new T.Vector3(0, 0.77, 0.53), new T.Euler(0, 0, 0), new T.Vector3(0.5, 0.25, 0.24),
  ), [source])
  useEffect(() => () => { rig.dispose() }, [rig])
  useEffect(() => () => { emblem.dispose() }, [emblem])
  useEffect(() => { onReady() }, [onReady])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  useEffect(() => {
    if (!reduced && animated && photoPose === null) return bindLionGaze(gl.domElement, gaze)
    gaze.active = false
    if (reduced || photoPose !== null) { gaze.eyes.set(0, 0); gaze.head.set(0, 0) }
  }, [gl, gaze, reduced, animated, photoPose])
  useEffect(() => {
    if (cheerRevision === seenCheerRevision.current) return
    seenCheerRevision.current = cheerRevision
    if (!cheerRevision || photoPose !== null) return
    if (elapsed.current - cheerAt.current < CHEER_DURATION) cheerQueued.current = true
    else cheerAt.current = elapsed.current
  }, [cheerRevision, photoPose])
  useEffect(() => {
    if (petRevision === seenPetRevision.current) return
    seenPetRevision.current = petRevision
    if (!petRevision || photoPose !== null) return
    if (reduced) {
      setReducedPetActive(true)
      return
    }
    // Coalesce repeated taps into one follow-up. Each response ends at zero,
    // so a second touch never snaps a half-finished smile or head tilt back.
    if (elapsed.current - petAt.current < PET_DURATION) petQueued.current = true
    else petAt.current = elapsed.current
  }, [petRevision, reduced, photoPose])
  useEffect(() => {
    if (!reducedPetActive) return
    const timeout = window.setTimeout(() => setReducedPetActive(false), PET_DURATION * 1000)
    return () => window.clearTimeout(timeout)
  }, [reducedPetActive, petRevision])
  useEffect(() => {
    if (photoPose === null) return
    cheerAt.current = petAt.current = reactionAt.current = -100
    cheerQueued.current = petQueued.current = false
    setReducedPetActive(false)
    gaze.active = false
    gaze.eyes.set(0, 0)
    gaze.head.set(0, 0)
    document.body.style.cursor = ''
    const age = photoPose === 'cheer' ? CHEER_PEAK_TIME : 100
    animateLionRig(rig, 0, 100, photoPose, age)
    smile.current = getSmileAmount(age)
    blink.current = 0
  }, [photoPose, rig, gaze])
  useEffect(() => {
    if (!reduced) {
      setReducedPetActive(false)
      return
    }
    if (reduced && photoPose === null) {
      cheerAt.current = petAt.current = reactionAt.current = -100
      cheerQueued.current = petQueued.current = false
      const age = pose === 'cheer' && cheerRevision > 0 ? CHEER_PEAK_TIME : 100
      const petAge = reducedPetActive ? PET_PEAK_TIME : 100
      animateLionRig(rig, 0, 100, pose, age, petAge)
      smile.current = getSmileAmount(age, 100, petAge)
      blink.current = 0
    }
  }, [reduced, pose, cheerRevision, rig, photoPose, reducedPetActive])
  useFrame(({ camera }, dt) => {
    if (photoPose !== null || reduced || !animated) return
    if (document.hidden) return
    elapsed.current += Math.min(dt, 0.05)
    if (cheerQueued.current && elapsed.current - cheerAt.current >= CHEER_DURATION) {
      cheerAt.current = elapsed.current
      cheerQueued.current = false
    }
    if (petQueued.current && elapsed.current - petAt.current >= PET_DURATION) {
      petAt.current = elapsed.current
      petQueued.current = false
    }
    const reactionAge = elapsed.current - reactionAt.current, cheerAge = elapsed.current - cheerAt.current
    const petAge = elapsed.current - petAt.current
    blink.current = animateLionRig(rig, elapsed.current, reactionAge, pose, cheerAge, petAge)
    smile.current = getSmileAmount(cheerAge, reactionAge, petAge)
    updateLionGaze(gaze, rig, camera, dt, (1 - smile.current * 0.35) * (1 - getPetAmount(petAge) * 0.8))
  }, -1)

  function respond(id: number) {
    if (photoPose !== null) return
    if (!reduced && animated) reactionAt.current = elapsed.current
    onSelect(id)
  }

  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (event.delta >= 6 || photoPose !== null) return
    if (event.face) {
      const skinIndex = rig.mesh.geometry.getAttribute('skinIndex')
      const skinWeight = rig.mesh.geometry.getAttribute('skinWeight')
      let armWeight = 0
      for (const vertex of [event.face.a, event.face.b, event.face.c]) {
        for (let slot = 0; slot < 4; slot++) {
          if (rig.armIndices.includes(skinIndex.array[vertex * 4 + slot])) armWeight += skinWeight.array[vertex * 4 + slot]
        }
      }
      if (armWeight > 1.05) { respond(4); return }
    }
    // Raycast the visible surface, so the back of the mane cannot select the face.
    const point = event.eventObject.worldToLocal(event.point.clone())
    if (isPetPoint(point)) { onPet(); return }
    respond(lionPart(point))
  }

  return (
    <group position={[0, LION_GROUND, 0]}>
      <primitive object={rig.mesh} dispose={null} onClick={select}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); if (photoPose === null) document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }} />
      {createPortal(<group position={[0, -HEAD_PIVOT, 0]} onClick={event => { event.stopPropagation(); if (event.delta < 6) respond(2) }}>
        <FaceDetails blink={blink} smile={smile} gaze={gaze} />
      </group>, rig.head)}
      {createPortal(<mesh geometry={emblem} position={[0, -BODY_PIVOT, 0]} onClick={event => { event.stopPropagation(); if (event.delta < 6) respond(3) }}>
        <meshStandardMaterial map={texture} transparent alphaTest={0.08} roughness={0.58} depthWrite={false}
          polygonOffset polygonOffsetFactor={-4} />
      </mesh>, rig.body)}
    </group>
  )
}
