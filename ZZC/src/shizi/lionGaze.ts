import * as T from 'three'
import type { LionRig } from './lionMotion'

export function createLionGaze() {
  return {
    pointer: new T.Vector2(), eyes: new T.Vector2(), head: new T.Vector2(),
    active: false, expires: Infinity,
    offset: new T.Vector3(), right: new T.Vector3(), up: new T.Vector3(),
    view: new T.Vector3(), origin: new T.Vector3(), inverse: new T.Quaternion(),
  }
}

export type LionGaze = ReturnType<typeof createLionGaze>

export function bindLionGaze(canvas: HTMLCanvasElement, gaze: LionGaze) {
  let press: { id: number; x: number; y: number; moved: boolean } | null = null
  const clear = () => { gaze.active = false }
  const sample = (event: PointerEvent, expires = Infinity) => {
    const rect = canvas.getBoundingClientRect()
    gaze.pointer.set(
      T.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1),
      T.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1),
    )
    gaze.active = true
    gaze.expires = expires
  }
  const down = (event: PointerEvent) => {
    clear()
    if (!event.isPrimary) { if (press) press.moved = true; return }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
  }
  const move = (event: PointerEvent) => {
    if (!event.isPrimary) return
    if (press || event.buttons) {
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true
      clear()
      return
    }
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') sample(event)
  }
  const up = (event: PointerEvent) => {
    const tap = press?.id === event.pointerId && !press.moved
      && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 6
    press = null
    clear()
    // A tap gets a brief look; dragging and pinching only control the camera.
    if (tap && event.pointerType !== 'mouse' && event.target === canvas) sample(event, performance.now() + 1400)
  }
  const cancel = () => { press = null; clear() }
  const lostCapture = () => { if (press) cancel() }
  const visibility = () => { if (document.hidden) cancel() }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerleave', clear)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('lostpointercapture', lostCapture)
  canvas.addEventListener('wheel', clear, { passive: true })
  window.addEventListener('pointerup', up)
  window.addEventListener('blur', cancel)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    cancel()
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerleave', clear)
    canvas.removeEventListener('pointercancel', cancel)
    canvas.removeEventListener('lostpointercapture', lostCapture)
    canvas.removeEventListener('wheel', clear)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('blur', cancel)
    document.removeEventListener('visibilitychange', visibility)
  }
}

// Screen directions are converted through the current camera and body rotation.
// The eyes lead; the head follows gently. Side/back views fade the response out.
export function updateLionGaze(gaze: LionGaze, rig: LionRig, camera: T.Camera, dt: number, attention = 1, now = performance.now()) {
  let x = 0, y = 0
  if (gaze.active && now < gaze.expires) {
    rig.body.getWorldQuaternion(gaze.inverse).invert()
    rig.head.getWorldPosition(gaze.origin)
    camera.getWorldPosition(gaze.view).sub(gaze.origin).normalize().applyQuaternion(gaze.inverse)
    const facing = T.MathUtils.smoothstep(gaze.view.z, 0.12, 0.65) * attention
    gaze.right.setFromMatrixColumn(camera.matrixWorld, 0)
    gaze.up.setFromMatrixColumn(camera.matrixWorld, 1)
    gaze.offset.copy(gaze.right).multiplyScalar(gaze.pointer.x).addScaledVector(gaze.up, gaze.pointer.y).applyQuaternion(gaze.inverse)
    x = T.MathUtils.clamp(gaze.offset.x, -1, 1) * facing
    y = T.MathUtils.clamp(gaze.offset.y, -1, 1) * facing
  }
  const step = Math.min(dt, 0.05)
  gaze.eyes.x = T.MathUtils.damp(gaze.eyes.x, x, 12, step)
  gaze.eyes.y = T.MathUtils.damp(gaze.eyes.y, y, 12, step)
  gaze.head.x = T.MathUtils.damp(gaze.head.x, x, 3.5, step)
  gaze.head.y = T.MathUtils.damp(gaze.head.y, y, 3.5, step)
  rig.head.rotation.y += gaze.head.x * 0.045
  rig.head.rotation.x -= gaze.head.y * 0.025
}
