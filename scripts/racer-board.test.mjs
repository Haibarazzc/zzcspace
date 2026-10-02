import assert from 'node:assert/strict';
import { test } from 'node:test';
import board from '../api/racer-board.ts';

// 信任制排行榜：客户端申报时间，服务端只做配置/范围校验、限流、幂等与榜单维护
const CONFIG = { track: 'sakura', car: 0, mode: 'time', laps: 1, difficulty: 1, autoAccelerate: true };

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body },
  };
}

test('leaderboard API: start, trusted finish, listing and guards', async t => {
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
        const session = sessions.get(keys[0]);
        if (!session) return Response.json({ result: 0 });
        if (session.saved) return Response.json({ result: 2 });
        session.saved = JSON.parse(args[1]);
        savedScore = Number(args[0]);
        boards.set(keys[1], [args[1]]);
        return Response.json({ result: 1 });
      }
      return Response.json({ result: 1 });
    }
    if (op === 'ZRANGE') {
      const rows = boards.get(command[1]) ?? [];
      if (command.length > 4) return Response.json({ result: rows });
      return Response.json({ result: rows.slice(command[2], command[3] === -1 ? undefined : command[3] + 1) });
    }
    if (op === 'ZCARD') return Response.json({ result: boards.get(command[1])?.length ?? 0 });
    return Response.json({ result: null });
  });

  // 未开始会话直接提交 → 400
  let res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId: 'x', name: '车手' } }, res);
  assert.equal(res.statusCode, 400);

  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'start', playerId: crypto.randomUUID() } }, res);
  assert.equal(res.statusCode, 200);
  const sessionId = JSON.parse(res.body).sessionId;

  // 非法昵称 → 400
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId, name: 'x'.repeat(13) } }, res);
  assert.equal(res.statusCode, 400);

  // 成绩超范围 / 非法配置 → 400
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId, name: '车手', config: CONFIG, time: 2 } }, res);
  assert.equal(res.statusCode, 400);
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId, name: '车手', config: { ...CONFIG, track: 'moon' }, time: 30 } }, res);
  assert.equal(res.statusCode, 400);

  // 正常提交：时间按申报记录
  res = response();
  await board({ method: 'POST', url: '/api/racer-board', headers: {}, body: { action: 'finish', sessionId, name: '测试车手', config: CONFIG, time: 24.8666666 } }, res);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(savedScore, 24867, '入库时间为申报值四舍五入到毫秒');
  assert.equal(JSON.parse(res.body).rank, 1);

  // 榜单查询
  res = response();
  await board({ method: 'GET', url: '/api/racer-board?track=sakura&car=0&mode=time&laps=1&difficulty=1' }, res);
  assert.equal(res.statusCode, 200);
  const list = JSON.parse(res.body);
  assert.equal(list.total, 1);
  assert.equal(list.entries[0].name, '测试车手');
  assert.equal(list.entries[0].time, 24.867);
});
