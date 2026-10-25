import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { apiFixture, flush, response } from './runtime-fixtures.mjs'

test('request: valid JSON succeeds and clears the deadline/listeners', async () => {
  const { timer, request } = apiFixture(async () => response({ ok: true, session_id: 'demo' }))
  const c = new AbortController()
  assert.equal((await request('/api/aurora/session', {}, c)).session_id, 'demo')
  assert.equal(timer.pending.size, 0)
  assert.equal(getEventListeners(c.signal, 'abort').length, 0)
})

test('request: already-aborted request never reaches fetch', async () => {
  let calls = 0
  const { timer, request } = apiFixture(async () => { calls++; return response({ ok: true }) })
  const c = new AbortController(); c.abort()
  await assert.rejects(request('/api/aurora/session', {}, c), { name: 'AbortError' })
  assert.equal(calls, 0); assert.equal(timer.pending.size, 0)
})

for (const stage of ['fetch', 'body']) {
  for (const reason of ['deadline', 'manual cancel']) {
    test(`request: ${reason} terminates a non-cooperative ${stage} promise`, async () => {
      const never = new Promise(() => {})
      const { timer, request } = apiFixture(stage === 'fetch' ? () => never : async () => ({ ok: true, json: () => never }))
      const c = new AbortController(); let outcome = 'pending'
      const pending = request('/api/aurora/session', {}, c)
      pending.then(() => { outcome = 'resolved' }, () => { outcome = 'rejected' })
      await flush()
      if (reason === 'deadline') timer.expire(); else c.abort()
      await flush()
      assert.equal(outcome, 'rejected')
      assert.equal(timer.pending.size, 0)
      assert.equal(getEventListeners(c.signal, 'abort').length, 0)
    })
  }
}

test('request: late response after cancellation cannot turn failure into success', async () => {
  let deliver
  const { request, timer } = apiFixture(() => new Promise(r => { deliver = r }))
  const c = new AbortController(); let outcome = 'pending'
  const p = request('/api/aurora/session', { method: 'POST' }, c)
  p.then(() => { outcome = 'resolved' }, () => { outcome = 'rejected' })
  c.abort(); await flush()
  deliver(response({ ok: true })); await flush()
  assert.equal(outcome, 'rejected'); assert.equal(timer.pending.size, 0)
})

test('request: network failure is not retried and releases resources', async () => {
  let calls = 0
  const { request, timer } = apiFixture(async () => { calls++; throw new Error('offline') })
  const c = new AbortController()
  await assert.rejects(request('/api/aurora/session', { method: 'PATCH' }, c), /offline/)
  assert.equal(calls, 1); assert.equal(timer.pending.size, 0)
  assert.equal(getEventListeners(c.signal, 'abort').length, 0)
})

const invalids = [null, undefined, [], ['ok'], 0, 1, -1, true, false, '', 'ok', {}, { ok: false }, { ok: 'true' }, { ok: 1 }, { ok: null }]
for (let i = 0; i < invalids.length; i++) {
  test(`request: malformed response ${i} is rejected`, async () => {
    const { request, timer } = apiFixture(async () => response(invalids[i]))
    const c = new AbortController()
    await assert.rejects(request('/api/aurora/session', {}, c))
    assert.equal(timer.pending.size, 0)
    assert.equal(getEventListeners(c.signal, 'abort').length, 0)
  })
}
for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504]) {
  test(`request: HTTP ${status} cannot claim a successful save`, async () => {
    const { request } = apiFixture(async () => ({ ...response({ ok: true }, false), status }))
    await assert.rejects(request('/api/aurora/session', {}, new AbortController()))
  })
}

test('request: malformed JSON rejects and clears timeout', async () => {
  const { request, timer } = apiFixture(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON') } }))
  await assert.rejects(request('/api/aurora/session', {}, new AbortController()))
  assert.equal(timer.pending.size, 0)
})

