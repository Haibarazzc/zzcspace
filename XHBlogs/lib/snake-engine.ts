// The browser and score verifier use the same deterministic rules.
export const BOARD_SIZE = 20;
export const MAX_TICKS = 12_000;
export type Direction = 0 | 1 | 2 | 3; // up, right, down, left
export type Point = { x: number; y: number };
export type Turn = { tick: number; direction: Direction };
export type SnakeState = {
  body: Point[];
  direction: Direction;
  food: Point | null;
  random: number;
  score: number;
  ticks: number;
  elapsed: number;
  over: boolean;
  reason: 'wall' | 'self' | 'filled' | 'limit' | null;
};

export function createGame(seed: number): SnakeState {
  return {
    body: [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
    direction: 1, food: { x: 14, y: 10 }, random: seed >>> 0 || 1,
    score: 0, ticks: 0, elapsed: 0, over: false, reason: null,
  };
}

export function tickDuration(score: number): number {
  return Math.max(75, 160 - Math.floor(score / 50) * 12);
}

export function canTurn(from: Direction, to: Direction): boolean {
  return Number.isInteger(to) && to >= 0 && to <= 3 && to !== from && (from + 2) % 4 !== to;
}

function nextFood(state: SnakeState): void {
  const occupied = new Set(state.body.map(p => p.y * BOARD_SIZE + p.x));
  const free: Point[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!occupied.has(y * BOARD_SIZE + x)) free.push({ x, y });
    }
  }
  let random = state.random;
  random ^= random << 13;
  random ^= random >>> 17;
  random ^= random << 5;
  state.random = random >>> 0;
  state.food = free[state.random % free.length] ?? null;
  if (!state.food) { state.over = true; state.reason = 'filled'; }
}

export function stepGame(previous: SnakeState, turn?: Direction): SnakeState {
  if (previous.over) return previous;
  const state = { ...previous, body: [...previous.body] };
  if (turn !== undefined && canTurn(state.direction, turn)) state.direction = turn;
  state.ticks++;
  state.elapsed += tickDuration(state.score);
  const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][state.direction];
  const head = { x: state.body[0].x + dx, y: state.body[0].y + dy };
  const eating = head.x === state.food?.x && head.y === state.food?.y;
  if (head.x < 0 || head.y < 0 || head.x >= BOARD_SIZE || head.y >= BOARD_SIZE) {
    state.over = true; state.reason = 'wall';
  } else if (state.body.slice(0, eating ? undefined : -1).some(p => p.x === head.x && p.y === head.y)) {
    state.over = true; state.reason = 'self';
  } else {
    state.body.unshift(head);
    if (eating) { state.score += 10; nextFood(state); }
    else state.body.pop();
  }
  if (!state.over && state.ticks >= MAX_TICKS) { state.over = true; state.reason = 'limit'; }
  return state;
}

export function replayGame(seed: number, ticks: number, turns: unknown): SnakeState | null {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > MAX_TICKS || !Array.isArray(turns) || turns.length > ticks) return null;
  let lastTick = 0;
  for (const turn of turns) {
    if (!turn || !Number.isInteger(turn.tick) || turn.tick <= lastTick || turn.tick > ticks ||
        !Number.isInteger(turn.direction) || turn.direction < 0 || turn.direction > 3) return null;
    lastTick = turn.tick;
  }
  let state = createGame(seed);
  let index = 0;
  for (let tick = 1; tick <= ticks; tick++) {
    if (state.over) return null;
    const turn = turns[index]?.tick === tick ? turns[index++] : undefined;
    if (turn && !canTurn(state.direction, turn.direction)) return null;
    state = stepGame(state, turn?.direction);
  }
  return state.over ? state : null;
}
