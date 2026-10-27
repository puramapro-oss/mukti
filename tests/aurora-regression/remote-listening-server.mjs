import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serverFixture } from './remote-listening-fixtures.mjs'

test('server listener grant overrides a requested publishing capability and cannot publish data', async () => {
  const f = serverFixture()
  const result = await f.livekit.generateLiveKitToken({ circleId: 'test-circle', userId: 'listener', userName: 'Listener', listenOnly: true, canPublish: true })
  const token = JSON.parse(result.token)
  assert.equal(token.grant.canPublish, false)
  assert.equal(token.grant.canPublishData, false)
  assert.equal(token.grant.canSubscribe, true)
  assert.equal(token.grant.roomJoin, true)
  assert.equal(token.settings.ttl, 300)
})
test('normal interactive circle grants retain their existing defaults', async () => {
  const f = serverFixture()
  const result = await f.livekit.generateLiveKitToken({ circleId: 'test-circle', userId: 'speaker', userName: 'Speaker' })
  const token = JSON.parse(result.token)
  assert.equal(token.grant.canPublish, true)
  assert.equal(token.grant.canPublishData, true)
  assert.equal(token.settings.ttl, 7200)
})
test('receive-only route confirms its restricted grant without any hardware ownership check', async () => {
  const f = serverFixture()
  const result = await f.request({ listenOnly: true })
  assert.equal(result.status, 200)
  assert.equal(result.data.listenOnly, true)
  assert.equal(result.data.muted, true)
  assert.equal(JSON.parse(result.data.token).grant.canPublish, false)
  assert.equal(JSON.parse(result.data.token).grant.canPublishData, false)
  assert.equal(result.headers.get('Cache-Control'), 'no-store, private')
  assert.deepEqual(f.queried, ['circle_participants', 'circles', 'profiles'])
})
for (const body of [undefined, '', '{}', { listenOnly: false }]) {
  test('legacy interactive requests remain supported: ' + String(body), async () => {
    const f = serverFixture()
    const result = await f.request(body)
    assert.equal(result.status, 200)
    assert.equal(result.data.listenOnly, false)
    assert.equal(JSON.parse(result.data.token).grant.canPublish, true)
  })
}
for (const body of ['broken', 'null', '[]', 'true', '{"listenOnly":"true"}', '{"listenOnly":1}', '{"listenOnly":true,"canPublish":true}']) {
  test('invalid or privilege-shaped request is rejected: ' + body, async () => {
    const f = serverFixture()
    const result = await f.request(body)
    assert.equal(result.status, 400)
    assert.equal(f.issued.length, 0)
    assert.equal(f.queried.length, 0)
  })
}
test('oversized token request is refused before database access', async () => {
  const f = serverFixture()
  const result = await f.request(' '.repeat(1025))
  assert.equal(result.status, 413)
  assert.equal(f.issued.length, 0)
  assert.equal(f.queried.length, 0)
})
for (const [name, options, status] of [
  ['no authentication', { authenticated: false }, 401],
  ['not a member', { data: { circle_participants: null } }, 403],
  ['unknown circle', { data: { circles: null } }, 404],
  ['closed circle', { data: { circles: { audio_mode: 'sfu', status: 'closed' } } }, 410],
  ['mesh circle', { data: { circles: { audio_mode: 'mesh', status: 'open' } } }, 409],
  ['no service configuration', { configured: false }, 503],
  ['rate limited', { rateLimited: true }, 429],
]) {
  test('listening does not bypass ' + name, async () => {
    const f = serverFixture(options)
    const result = await f.request({ listenOnly: true })
    assert.equal(result.status, status)
    assert.equal(f.issued.length, 0)
  })
}
test('existing server-side microphone mute is respected in conversation mode', async () => {
  const f = serverFixture({ data: { circle_participants: { id: 'p', mic_muted: true, role: 'member' } } })
  const result = await f.request({ listenOnly: false })
  assert.equal(result.status, 200)
  assert.equal(JSON.parse(result.data.token).grant.canPublish, false)
})
