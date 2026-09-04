import assert from 'node:assert/strict'
import { test } from 'node:test'
import mapNotes from '../ZZC/api/map-notes.ts'
import track from '../ZZC/api/track.ts'
import logs from '../ZZC/api/logs.ts'

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body },
    end(body = '') { this.body = body },
  }
}

test('map notes read/write, authentication and failed storage; tracking and protected logs', async t => {
  const env = { ...process.env }
  t.after(() => { process.env = env })
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    MAP_ADMIN_PASSWORD: 'test-password',
    LOGS_KEY: 'test-logs-key',
  })
  const places = [{ id: 'test', name: 'Test location', x: 100, y: 100, category: 'other' }]
  const commands = []
  let failStorage = false
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const command = JSON.parse(options.body)
    commands.push(command)
    if (failStorage) return Response.json({ error: 'Unavailable' }, { status: 503 })
    const result = command[0] === 'GET' ? JSON.stringify(places) : command[0] === 'SET' ? 'OK' : 1
    return Response.json({ result })
  })
  let res = response()
  await mapNotes({ method: 'GET' }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body).places, places)

  res = response()
  await mapNotes({ method: 'POST', body: { password: 'wrong', places } }, res)
  assert.equal(res.statusCode, 401)
  assert.equal(commands.length, 1, 'Unauthorized requests must not write to storage')

  res = response()
  await mapNotes({ method: 'POST', body: '{' }, res)
  assert.equal(res.statusCode, 400)

  res = response()
  await mapNotes({ method: 'POST', body: { password: 'test-password', places } }, res)
  assert.equal(JSON.parse(res.body).saved, true)
  assert.equal(commands.at(-1)[0], 'SET')

  failStorage = true
  res = response()
  await mapNotes({ method: 'POST', body: { password: 'test-password', places } }, res)
  assert.equal(res.statusCode, 503, 'Failed saves must not be reported as successful')
  assert.equal(JSON.parse(res.body).saved, undefined)

  failStorage = false
  res = response()
  t.mock.method(console, 'log', () => {})
  await track({ method: 'POST', headers: {}, url: '/api/track', body: { type: 'view', page: '/portfolio/about/' } }, res)
  assert.equal(res.statusCode, 204)
  assert.equal(commands.at(-1)[0], 'RPUSH')
  assert.equal(JSON.parse(commands.at(-1)[2]).page, '/portfolio/about/')

  res = response()
  const readsBefore = commands.length
  await logs({ url: '/api/logs' }, res)
  assert.equal(res.statusCode, 403)
  assert.equal(commands.length, readsBefore, 'Visitor logs must stay protected')
})
