import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, makeTrack, EMPTY_INPUT, CARS, formatTime } from '../XHBlogs/app/game/race-model.ts';

const config = { track: 'sakura', car: 0, difficulty: 1, laps: 1, mode: 'race', autoAccelerate: true };
const tick = (race, seconds, input = EMPTY_INPUT, hz = 120) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) race.update(1 / hz, typeof input === 'function' ? input(race) : input);
};
const drive = race => ({ ...EMPTY_INPUT, steer: Math.max(-1, Math.min(1, -race.player.offset * .15 + race.track.sample(race.player.distance + 8).curvature * race.player.speed * .88)) });
const running = (patch = {}) => { const race = new Race({ ...config, ...patch }); race.start(); tick(race, 3.6); return race; };

test('both wide circuits are closed and continuous at the lap seam', () => {
  for (const id of ['sakura', 'coast']) {
    const track = makeTrack(id);
    assert.ok(track.width >= 28);
    assert.ok(track.length > 1400);
    assert.deepEqual(track.sample(0), track.sample(track.length));
    const a = track.sample(-.01), b = track.sample(.01);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .03);
    for (const p of track.points) assert.ok(Number.isFinite(p.curvature) && Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-8);
  }
});

test('countdown, pause and resume freeze all racers and timers', () => {
  const race = new Race(config); race.start(); tick(race, 1);
  assert.equal(race.phase, 'countdown'); assert.equal(race.player.speed, 0);
  race.pause(); const snapshot = JSON.stringify(race.racers), count = race.countdown;
  tick(race, 10); assert.equal(race.countdown, count); assert.equal(JSON.stringify(race.racers), snapshot);
  race.resume(); tick(race, 3); assert.equal(race.phase, 'racing');
  race.pause(); const time = race.time; tick(race, 10); assert.equal(race.time, time);
});

test('a full race finishes with true lap time, ordered finishers and seven moving AI', () => {
  const race = running(); tick(race, 80, drive);
  assert.equal(race.phase, 'finished'); assert.equal(race.player.lapTimes.length, 1);
  assert.ok(race.player.distance >= race.track.length); assert.ok(race.player.lapTimes[0] > 15);
  assert.ok(Math.abs(race.player.lapTimes.reduce((sum, t) => sum + t, 0) - race.time) < 1e-8);
  assert.equal(race.racers.length, 8); assert.ok(race.racers.slice(1).every(r => r.distance > 1000));
  const times = race.order.filter(r => r.finishedAt !== null).map(r => r.finishedAt);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  const before = race.time; tick(race, 1); assert.equal(race.time, before);
});

test('three-lap races and practice do not stop at the first finish-line crossing', () => {
  for (const mode of ['time', 'practice']) {
    const race = running({ mode, laps: mode === 'time' ? 3 : 1 });
    tick(race, mode === 'time' ? 120 : 70, drive);
    assert.equal(race.racers.length, 1);
    assert.equal(race.phase, mode === 'time' ? 'finished' : 'racing');
    assert.ok(race.player.lapTimes.length >= 2);
    if (mode === 'time') assert.equal(race.player.lapTimes.length, 3);
  }
});

test('fixed-step handling produces identical races at 30, 60 and 120 Hz', () => {
  const races = [30, 60, 120].map(hz => {
    const race = new Race({ ...config, mode: 'practice' }); race.start();
    tick(race, 12, { ...EMPTY_INPUT, steer: .12 }, hz); return race;
  });
  for (const race of races.slice(1)) {
    assert.ok(Math.abs(race.player.distance - races[0].player.distance) < 1e-8);
    assert.ok(Math.abs(race.player.offset - races[0].player.offset) < 1e-8);
  }
});

test('stationary drifting cannot farm boost; valid drifting creates charge and release boost', () => {
  const parked = running({ autoAccelerate: false, mode: 'practice' });
  tick(parked, 5, { ...EMPTY_INPUT, drift: true, steer: 1 });
  assert.equal(parked.player.charge, 0); assert.equal(parked.player.speed, 0);
  const race = running({ mode: 'practice' }); tick(race, 3, drive);
  tick(race, 1.6, { ...EMPTY_INPUT, drift: true, steer: .28 });
  assert.ok(race.player.charge > 35); assert.ok(race.player.drifting);
  tick(race, .05); assert.ok(race.player.miniTime > .8); assert.equal(race.player.drifting, false);
});

test('nitro is bounded, needs a new press, and expiry restores base top speed', () => {
  const race = running({ mode: 'practice' }); race.track.pads = [];
  tick(race, 3, drive); const before = race.player.tanks;
  tick(race, .1, { ...EMPTY_INPUT, boost: true }); assert.equal(race.player.tanks, before - 1);
  assert.ok(race.player.boostTime > 0);
  tick(race, 5, { ...EMPTY_INPUT, boost: true }); assert.equal(race.player.tanks, 0); assert.equal(race.boostsUsed, 1);
  tick(race, 6, drive); assert.ok(race.player.speed <= CARS[0].maxSpeed + .001);
});

test('wall hits and pair collisions stay on the road, including across lap seam', () => {
  const race = running();
  race.racers.forEach((r, i) => { r.distance = i * 100; r.offset = 0; r.speed = 40; });
  const a = race.player, b = race.racers[1]; a.distance = race.track.length - 2; b.distance = 0;
  tick(race, 1 / 120); assert.ok(a.collisionTime > 0); assert.ok(Math.abs(a.offset - b.offset) >= 2.5);
  const walls = running({ mode: 'practice' }); tick(walls, 15, { ...EMPTY_INPUT, steer: -1, drift: true });
  assert.ok(Math.abs(walls.player.offset) <= walls.track.width / 2 - 1.3);
});

test('recovery stops the player for two seconds while opponents race; restart clears resources', () => {
  const race = running(); tick(race, 4, drive);
  const distance = race.player.distance, time = race.time; race.recover();
  assert.equal(race.player.distance, distance); assert.equal(race.time, time); assert.equal(race.player.offset, 0);
  const opponentDistance = race.racers[1].distance;
  tick(race, 1); assert.equal(race.player.distance, distance); assert.ok(race.racers[1].distance > opponentDistance);
  tick(race, 2); assert.ok(race.player.distance > distance);
  race.start(); assert.equal(race.phase, 'countdown'); assert.equal(race.time, 0);
  assert.equal(race.player.tanks, 1); assert.equal(race.player.charge, 0); assert.equal(race.player.speed, 0);
  assert.deepEqual(race.player.lapTimes, []); assert.equal(race.boostsUsed, 0);
});

test('AI reacts to nearby cars and difficulty changes actual race pace', () => {
  const easy = running({ difficulty: 0, mode: 'race' }), hard = running({ difficulty: 2, mode: 'race' });
  tick(easy, 15, drive); tick(hard, 15, drive);
  assert.ok(hard.racers.slice(1).reduce((s, r) => s + r.distance, 0) > easy.racers.slice(1).reduce((s, r) => s + r.distance, 0));
  assert.ok(hard.racers.slice(1).some(r => r.targetLane !== (r.id % 2 ? -4 : 4)));
  assert.ok(hard.racers.every(r => Number.isFinite(r.distance) && Number.isFinite(r.speed)));
});

test('time formatting handles missing records', () => {
  assert.equal(formatTime(65.123), '01:05.123'); assert.equal(formatTime(Infinity), '--:--.---');
});
