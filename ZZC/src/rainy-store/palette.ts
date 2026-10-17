/** Shared dimensions and the night palette of the rainy-corner diorama. */

export const BASE_SIZE = 10
export const BASE_HEIGHT = 0.34
export const SIDEWALK_Y = 0.072
export const ROAD_Y = 0.004

/** The konbini building (world units, metres). */
export const STORE = {
  x0: -2.7,
  x1: 2.1,
  z0: -3.3,
  z1: 0.3,
  floorY: 0.101,
  glassTop: 2.78,
  signBottom: 2.84,
  signTop: 3.48,
  roofY: 3.5,
  parapetTop: 3.86,
  doorX0: -0.32,
  doorX1: 0.92,
  doorTop: 2.5,
  eastGlassZ0: -1.5,
  eastGlassZ1: 0.18,
} as const

export const COL = {
  ink: 0x0b0813,
  glass: 0x9fd0e2,
  concrete: 0x9096a6,
  concreteDark: 0x5c6172,
  cream: 0xd9d4c5,
  tile: 0xb9bfc9,
  darkMetal: 0x2c303c,
  aluminium: 0x8d97a8,
  brass: 0xb08a45,
  green: 0x0d8264,
  orange: 0xf0a13c,
  warmLight: 0xffd6a0,
  coolLight: 0x9db8ff,
  neonPink: 0xff5fa2,
  neonCyan: 0x6fe3ff,
  red: 0xc9302c,
  bluePaint: 0x1e4f9c,
  wetRoad: 0x141a28,
  interiorFloor: 0xd6cbb4,
  wood: 0x6b4a34,
} as const

export const PRODUCT_COLORS = [
  0xe2533f, 0x2f7fc1, 0xf0b52e, 0x4caf72, 0x7c5cd6, 0xef7fa8, 0xffffff, 0x2d3a46,
  0xff8c42, 0x5ec7c9, 0xd94f6a, 0x8bc34a, 0xffd166, 0x6b8cff, 0xf06c9b, 0x3f4a5a,
] as const
