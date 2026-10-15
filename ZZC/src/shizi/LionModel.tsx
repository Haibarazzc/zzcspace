import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { animateLionRig, CHEER_DURATION, CHEER_PEAK_TIME, createLionRig, getPetAmount, getSmileAmount, PET_DURATION, PET_PEAK_TIME } from './lionMotion'
import { bindLionGaze, createLionGaze, updateLionGaze } from './lionGaze'
import type { PoseId } from './data'

// Bundle the model beside its chunk so nested portfolio routes share it.
import modelUrl from './shixiaoxin-complete.glb?url'
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
  const { scene } = useGLTF(modelUrl)
  const { gl } = useThree()
  const source = useMemo(() => {
    let found: T.Mesh<T.BufferGeometry, T.Material | T.Material[]> | undefined
    scene.traverse(object => { if (!found && object instanceof T.Mesh) found = object })
    if (!found) throw new Error('狮小新模型中没有可显示的网格。')
    return found
  }, [scene])
  const rig = useMemo(() => createLionRig(source.geometry, source.material), [source])
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
  function updateFace() {
    const influences = rig.mesh.morphTargetInfluences!
    const closure = 1 - (1 - blink.current) * (1 - smile.current * 0.96)
    influences[1] = closure
    influences[2] = gaze.eyes.x * (1 - closure)
    influences[3] = gaze.eyes.y * (1 - closure)
  }
  useEffect(() => () => { rig.dispose() }, [rig])
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
    updateFace()
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
      updateFace()
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
    updateFace()
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
    </group>
  )
}
