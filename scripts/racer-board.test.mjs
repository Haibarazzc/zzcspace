import assert from 'node:assert/strict';
import { test } from 'node:test';
import board, { verifyReplay } from '../api/racer-board.ts';
import { Race } from '../XHBlogs/app/game/race-model.ts';

// ---- 测试用驾驶机器人：与 AI 类似的转向逻辑，完整跑完一场并按客户端格式记录事件 ----
function botRace(config, { autoAccelerate = false } = {}) {
  const race = new Race({ ...config, autoAccelerate });
  race.start();
  const events = [];
  let lastKey = '';
  const inputFor = () => {
    const r = race.player;
    const road = race.track.sample(r.distance + 8);
    const ahead = race.track.sample(r.distance + 45);
    const curve = Math.max(Math.abs(road.curvature), Math.abs(ahead.curvature));
    const target = -Math.sign(road.curvature) * 3;
    return {
      steer: Math.max(-1, Math.min(1, (target - r.offset) * .12 + road.curvature * r.speed * .8)),
      accelerate: !autoAccelerate,
      brake: false,
      drift: curve > .007 && r.speed > 26,
      boost: false,
    };
  };
  let guard = 0;
  while (race.phase !== 'finished' && guard++ < 60_000) {
    const input = inputFor();
    const key = `${input.steer}|${+input.accelerate}${+input.brake}${+input.drift}${+input.boost}`;
    if (key !== lastKey) {
      lastKey = key;
      events.push({ t: race.time, s: input.steer, a: +input.accelerate, b: 0, d: +input.drift, g: 0 });
    }
    race.update(1 / 60, input);
  }
  return { race, events };
}

const CONFIG = { track: 'sakura', car: 0, mode: 'time', laps: 1, difficulty: 1, autoAccelerate: false };

test('replay verification matches the original run exactly and rejects tampering', async () => {
  const { race, events } = botRace(CONFIG);
  const finishedAt = race.player.finishedAt;
  assert.notEqual(finishedAt, null, 'bot must finish the race');
  assert.ok(events.length > 10, 'bot must produce input events');

  const verified = await verifyReplay(CONFIG, events);
  assert.ok(verified, 'replay must verify');
  assert.ok(Math.abs(verified.time - finishedAt) < 0.001, `time must match (sim ${finishedAt} vs replay ${verified.time})`);

  // 篡改：丢掉后半段事件 → 无法复原原成绩（不同时间或直接失败）
  const truncated = events.slice(0, Math.floor(events.length / 2));
  const tampered = await verifyReplay(CONFIG, truncated);
  assert.ok(!tampered || Math.abs(tampered.time - finishedAt) > 0.05, 'truncated replay must not reproduce the time');

  // 篡改：时间乱序 → 拒绝
  const shuffled = [...events].reverse();
  assert.equal(await verifyReplay(CONFIG, shuffled), null, 'out-of-order events must be rejected');

  // 非法配置 → 拒绝
  assert.equal(await verifyReplay({ ...CONFIG, laps: 9 }, events), null);
  assert.equal(await verifyReplay({ ...CONFIG, track: "moon" }, events), null);
});

test('autoAccelerate config must be honoured by the replay', async () => {
  // 客户端开着自动油门：事件里 accelerate 全为 0，回放也必须跑完
  const { race, events } = botRace(CONFIG, { autoAccelerate: true });
  assert.notEqual(race.player.finishedAt, null);
  const verified = await verifyReplay({ ...CONFIG, autoAccelerate: true }, events);
  assert.ok(verified, 'auto-accelerate replay must verify');
  assert.ok(Math.abs(verified.time - race.player.finishedAt) < 0.001);
});

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body },
  };
}

test('leaderboard API: start, verified finish, listing and guards', async t => {
  const env = { ...process.env };
  t.after(() => { process.env = env });
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  });
  const sessions = new Map();
  const boards = new Map();
  let savedScore = null;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const command = JSON.parse(options.body);
    const [op] = command;
    if (op === 'SET') { sessions.set(command[1], JSON.parse(command[2])); return Response.json({ result: 'OK' }); }
    if (op === 'GET') { const v = sessions.get(command[1]); return Response.json({ result: v === undefined ? null : JSON.stringify(v) }); }
    if (op === 'EVAL') {
      const script = command[1], keys = command.slice(3, 3 + command[2]), args = command.slice(3 + command[2]);
      if (script.includes('INCR')) return Response.json({ result: 1 });
      if (script.includes('ZADD')) {
        const sessionKey = keys[0], boardKey = keys[1];
        const session = sessions.get(sessionKey);
        if (!session) return Response.json({ result: 0 });
        if (session.saved) return Response.json({ result: 2 });
        session.saved = JSON.parse(args[1]);
        savedScore = Number(args[0]);
        boards.set(boardKey, [args[1]]);
        return Response.json({ result: 1 });
      }
      return Response.json({ result: 1 });
    }
    if (op === 'ZRANGE') {
      const rows = boards.get(command[1]) ?? [];
      if (command.length > 4) return Response.json({ result: rows }); // 带 rank 的全量查询
      return Response.json({ result: rows.slice(command[2], command[3] === -1 ? undefined : command[3] + 1) });
    }
    if (op === 'ZCARD') return Response.json({ result: boards.get(command[1])?.length ?? 0 });
    return Response.json({ result: null });
  });

  const { race, events } = botRace(CONFIG);
  const expected = race.player.finishedAt;

  // 未开始会话直接提交 → 400
  let res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId: 'x', name: '车手' } }, res);
  assert.equal(res.statusCode, 400);

  // 非法昵称 → 400
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'start', playerId: crypto.randomUUID() } }, res);
  assert.equal(res.statusCode, 200);
  const sessionId = JSON.parse(res.body).sessionId;
  // 防作弊要求真实耗时 >= 模拟耗时：把会话开始时间倒拨两分钟
  for (const v of sessions.values()) if (v.startedAt) v.startedAt = Date.now() - 120_000;

  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId, name: 'x'.repeat(13) } }, res);
  assert.equal(res.statusCode, 400);

  // 事件被截断：要么被拒，要么得到一个慢得多的成绩（贴墙也能磨完一圈，但绝不能复现原时间）
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {},
    body: { action: 'finish', sessionId, name: '作弊者', config: CONFIG, events: events.slice(0, 5) } }, res);
  const tamperedBody = JSON.parse(res.body);
  assert.ok(res.statusCode !== 200 || tamperedBody.error
    || Math.abs((savedScore ?? Infinity) / 1000 - expected) > 0.05, 'tampered run must not reproduce the time');

  // 真实对局（新会话）→ 上榜，入库时间与重放一致
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'start', playerId: crypto.randomUUID() } }, res);
  const sessionId2 = JSON.parse(res.body).sessionId;
  for (const v of sessions.values()) if (v.startedAt) v.startedAt = Date.now() - 120_000;
  savedScore = null;
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {},
    body: { action: 'finish', sessionId: sessionId2, name: '测试车手', config: CONFIG, events } }, res);
  assert.equal(res.statusCode, 200, res.body);
  assert.ok(Math.abs(savedScore / 1000 - expected) < 0.001, `saved ${savedScore}ms vs sim ${expected * 1000}ms`);

  // 榜单查询
  res = response();
  await board({ method: 'GET', url: '/api/racer-board?track=sakura&car=0&mode=time&laps=1&difficulty=1' }, res);
  assert.equal(res.statusCode, 200);
  const list = JSON.parse(res.body);
  assert.equal(list.total, 1);
  assert.equal(list.entries[0].name, '测试车手');
  assert.ok(Math.abs(list.entries[0].time - expected) < 0.001);
});
