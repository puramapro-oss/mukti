import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioTrack, deferred, events, flush, listenerFixture } from './remote-listening-fixtures.mjs'

test('listener requests a receive-only token once and never accesses a publishing API', async () => {
  const f = listenerFixture()
  await Promise.all([f.handle.start(), f.handle.start()])
  assert.equal(f.calls.length, 1)
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { listenOnly: true })
  assert.equal(f.rooms.length, 1)
  assert.equal(f.rooms[0].connection.settings.autoSubscribe, false)
  assert.equal(f.microphoneAccess(), 0)
  f.handle.stop()
})
test('stopping while fetching a token discards a late response without creating a room', async () => {
  const pending = deferred()
  const f = listenerFixture({ fetch: () => pending.promise })
  const start = f.handle.start()
  f.handle.stop()
  await start
  pending.resolve({ ok: true, json: async () => ({ ok: true, token: 'late', url: 'wss://relay.test', listenOnly: true }) })
  await flush()
  assert.equal(f.rooms.length, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(f.errors.length, 0)
})
test('stopping during connection also disconnects a late successful connection', async () => {
  const pending = deferred()
  const f = listenerFixture({ connect: () => pending.promise })
  const start = f.handle.start()
  await flush()
  assert.equal(f.rooms.length, 1)
  f.handle.stop()
  await start
  pending.resolve()
  await flush()
  assert.ok(f.rooms[0].disconnects >= 2)
  assert.equal(f.inserted.length, 0)
  assert.equal(f.timers.size, 0)
})
test('only audio publications are subscribed, including tracks already in the room', async () => {
  const subscribed = []
  const audio = { kind: 'audio', setSubscribed: (v) => subscribed.push(['audio', v]) }
  const video = { kind: 'video', setSubscribed: (v) => subscribed.push(['video', v]) }
  const participants = new Map([['host', { trackPublications: new Map([['a', audio], ['v', video]]) }]])
  const f = listenerFixture({ participants })
  await f.handle.start()
  f.rooms[0].emit(events.TrackPublished, video)
  f.rooms[0].emit(events.TrackPublished, audio)
  assert.deepEqual(subscribed, [['audio', true], ['audio', true]])
  f.handle.stop()
})
test('two audio tracks from one participant remain independent and stop locally together', async () => {
  const f = listenerFixture()
  await f.handle.start()
  const voice = audioTrack({ failPause: true }), music = audioTrack()
  f.rooms[0].emit(events.TrackSubscribed, voice)
  f.rooms[0].emit(events.TrackSubscribed, music)
  assert.equal(f.inserted.length, 2)
  assert.ok(f.inserted.every((e) => e.volume === 0.25))
  f.handle.stop()
  assert.ok(f.inserted.every((e) => e.volume === 0 && e.srcObject === null && e.removed))
  assert.equal(f.rooms[0].disconnects, 1)
  f.handle.stop()
  assert.equal(f.rooms[0].disconnects, 1)
})
test('an unsubscribed track is removed without silencing another track', async () => {
  const f = listenerFixture()
  await f.handle.start()
  const first = audioTrack(), second = audioTrack()
  f.rooms[0].emit(events.TrackSubscribed, first)
  f.rooms[0].emit(events.TrackSubscribed, second)
  f.rooms[0].emit(events.TrackUnsubscribed, first)
  assert.equal(first.elements[0].removed, true)
  assert.equal(second.elements[0].removed, false)
  f.handle.stop()
})
test('a queued track event after Stop cannot restore audio', async () => {
  const f = listenerFixture()
  await f.handle.start()
  const callback = f.rooms[0].handlers.get(events.TrackSubscribed)
  f.handle.stop()
  callback(audioTrack())
  assert.equal(f.inserted.length, 0)
})
for (const [input, expected] of [[NaN, 0], [Infinity, 0], [-1, 0], [0, 0], [0.4, 0.4], [2, 1]]) {
  test(`listener bounds local gain ${String(input)} without altering the source`, async () => {
    const f = listenerFixture()
    await f.handle.start()
    const track = audioTrack()
    f.rooms[0].emit(events.TrackSubscribed, track)
    f.handle.setVolume(input)
    assert.equal(track.elements[0].volume, expected)
    f.handle.stop()
    f.handle.setVolume(1)
    assert.equal(track.elements[0].volume, 0)
  })
}
test('blocked autoplay is reported and can be resumed by a separate user action', async () => {
  const f = listenerFixture()
  await f.handle.start()
  f.rooms[0].emit(events.TrackSubscribed, audioTrack({ rejectPlay: true }))
  await flush()
  assert.equal(f.states.at(-1), 'playback-blocked')
  assert.equal(f.rooms[0].audioStarts, 0)
  await f.handle.resumeAudio()
  assert.equal(f.rooms[0].audioStarts, 1)
  assert.equal(f.states.at(-1), 'connected')
  f.handle.stop()
})
test('a final disconnection silences local outputs and does not start a microphone', async () => {
  const f = listenerFixture()
  await f.handle.start()
  f.rooms[0].emit(events.TrackSubscribed, audioTrack())
  f.rooms[0].emit(events.Disconnected)
  assert.ok(f.inserted.every((e) => e.removed && e.volume === 0))
  assert.equal(f.errors.length, 1)
  assert.equal(f.microphoneAccess(), 0)
})
test('reconnection state does not create another room or increase output gain', async () => {
  const f = listenerFixture()
  await f.handle.start()
  f.rooms[0].emit(events.TrackSubscribed, audioTrack())
  f.rooms[0].emit(events.Reconnecting)
  assert.equal(f.states.at(-1), 'reconnecting')
  f.rooms[0].emit(events.Reconnected)
  assert.equal(f.states.at(-1), 'connected')
  assert.equal(f.rooms.length, 1)
  assert.equal(f.inserted[0].volume, 0.25)
  f.handle.stop()
})
for (const result of [
  { ok: true, token: 'x', url: 'wss://relay.test' },
  { ok: true, token: '', url: 'wss://relay.test', listenOnly: true },
  { ok: true, token: 'x', url: 'http://relay.test', listenOnly: true },
  { ok: true, token: 'x', url: 'wss://user:secret@relay.test', listenOnly: true },
]) {
  test('listener refuses unconfirmed mode or invalid credentials: ' + JSON.stringify(result), async () => {
    const f = listenerFixture({ result })
    await f.handle.start()
    assert.equal(f.rooms.length, 0)
    assert.equal(f.errors.length, 1)
    assert.equal(f.timers.size, 0)
  })
}
test('membership refusal cannot be converted into a successful playback or retried automatically', async () => {
  const f = listenerFixture({ httpOk: false, result: { error: 'Forbidden' } })
  await f.handle.start()
  assert.equal(f.calls.length, 1)
  assert.equal(f.rooms.length, 0)
  assert.equal(f.errors.length, 1)
})
for (const phase of ['fetch', 'body', 'connect']) {
  test(`listener bounds a non-cooperative ${phase} wait and clears its resources`, async () => {
    const pending = deferred()
    const options = phase === 'fetch' ? { fetch: () => pending.promise }
      : phase === 'body' ? { fetch: async () => ({ ok: true, json: () => pending.promise }) }
        : { connect: () => pending.promise }
    const f = listenerFixture(options)
    const start = f.handle.start()
    await flush()
    f.expire()
    await start
    assert.equal(f.errors.length, 1)
    assert.equal(f.timers.size, 0)
    if (phase === 'connect') {
      pending.resolve()
      await flush()
      assert.ok(f.rooms[0].disconnects >= 2)
    }
  })
}
