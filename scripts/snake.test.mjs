import assert from 'node:assert/strict';
import { test } from 'node:test';
import snake from '../api/snake.ts';
import { createGame, stepGame, canTurn } from '../XHBlogs/lib/snake-engine.ts';

test('engine: eat, grow, speed up, crash into wall', () => {
  let game = createGame(1);
  assert.deepEqual(game.body[0], { x: 8, y: 10 }, '蛇头初始位置');
  assert.equal(game.direction, 1, '初始向右');
  assert.equal(canTurn(1, 3), false, '不能原地掉头');
  assert.equal(canTurn(1, 0), true, '可以拐弯');

  for (let i = 0; i < 6; i++) game = stepGame(game); // (8,10) -> (14,10) 吃到食物
  assert.equal(game.score, 10, '吃到第一颗食物 +10');
  assert.equal(game.body.length, 4, '身体 +1');

  for (let i = 0; i < 6 && !game.over; i++) game = stepGame(game); // (14,10) -> (20,10) 撞墙
  assert.equal(game.over, true);
  assert.equal(game.reason, 'wall');
});

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body },
  };
}

test('snake board API: start, trusted finish, listing and guards', async t => {
  const env = { ...process.env };
  t.after(() => { process.env = env });
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  });
  const sessions = new Map();
  const players = new Map();
  const zset = new Map();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const command = JSON.parse(options.body);
    const [op] = command;
    if (op === 'SET') { sessions.set(command[1], JSON.parse(command[2])); return Response.json({ result: 'OK' }); }
    if (op === 'GET') { const v = sessions.get(command[1]); return Response.json({ result: v === undefined ? null : JSON.stringify(v) }); }
    if (op === 'EVAL') {
      const script = command[1], keys = command.slice(3, 3 + command[2]), args = command.slice(3 + command[2]);
      if (script.includes('INCR')) return Response.json({ result: 1 });
      if (script.includes('ZREVRANGE') && script.includes('HGET')) {
        // READ_BOARD：当前榜单键上的成员按分数倒序，取各自 hash 里的条目
        const members = [...zset.entries()].filter(([k]) => k.startsWith(keys[0] + ':')).sort((a, b) => b[1] - a[1]).slice(0, 20);
        return Response.json({ result: members.map(m => players.get(m[0])).filter(Boolean) });
      }
      if (script.includes('ZADD')) {
        // SAVE_SCORE：keys = [session, 总榜, 总榜hash, 日榜, 日榜hash]，榜单为 keys[1]/keys[3]
        const sessionKey = keys[0];
        const session = sessions.get(sessionKey);
        if (!session) return Response.json({ result: null });
        if (session.saved) return Response.json({ result: JSON.stringify(session.saved) });
        const player = session.player, score = Number(args[0]);
        for (const key of [keys[1], keys[3]]) {
          const member = key + ':' + player;
          if (score > (zset.get(member) ?? -1)) { zset.set(member, score); players.set(member, args[1]); }
        }
        const rank = [...zset.entries()].filter(([k]) => k.startsWith(keys[1] + ':')).sort((a, b) => b[1] - a[1]).findIndex(([k]) => k === keys[1] + ':' + player) + 1;
        session.saved = { saved: true, score, rank: rank || null };
        return Response.json({ result: JSON.stringify(session.saved) });
      }
      return Response.json({ result: 1 });
    }
    return Response.json({ result: null });
  });

  // 未开始会话直接提交 → 400
  let res = response();
  await snake({ method: 'POST', url: '/api/snake', headers: {}, body: { action: 'finish', sessionId: 'x', name: 'a', score: 10 } }, res);
  assert.equal(res.statusCode, 400);

  res = response();
  await snake({ method: 'POST', url: '/api/snake', headers: {}, body: { action: 'start', playerId: crypto.randomUUID() } }, res);
  assert.equal(res.statusCode, 200);
  const sessionId = JSON.parse(res.body).sessionId;

  // 非法昵称 / 分数超范围 → 400
  res = response();
  await snake({ method: 'POST', url: '/api/snake', headers: {}, body: { action: 'finish', sessionId, name: 'x'.repeat(13), score: 10 } }, res);
  assert.equal(res.statusCode, 400);
  res = response();
  await snake({ method: 'POST', url: '/api/snake', headers: {}, body: { action: 'finish', sessionId, name: '玩家', score: 9999 } }, res);
  assert.equal(res.statusCode, 400);

  // 正常提交 80 分
  res = response();
  await snake({ method: 'POST', url: '/api/snake', headers: {}, body: { action: 'finish', sessionId, name: '测试玩家', score: 80 } }, res);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(JSON.parse(res.body).rank, 1);

  // 榜单查询
  res = response();
  await snake({ method: 'GET', url: '/api/snake?period=all' }, res);
  assert.equal(res.statusCode, 200);
  const list = JSON.parse(res.body);
  assert.equal(list.entries[0].name, '测试玩家');
  assert.equal(list.entries[0].score, 80);
});
