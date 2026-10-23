/** Actual server helper executed with a fake service client; no database connection. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const sourceDir = process.env.MUKTI_SOURCE_DIR || path.resolve(__dirname, '../../src/lib')
const levels = [{ id: 'brume' }, { id: 'onde' }, { id: 'aura' }, { id: 'polaris' }]
function load(file, require) {
  const code = ts.transpileModule(fs.readFileSync(path.join(sourceDir, file + '.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require }, { filename: file + '.js' })
  return exports
}
function fixture(reply, error = null, reject = false) {
  const calls = []
  const completion = load('aurora-completion', name => {
    assert.equal(name, './constants/aurora'); return { AURORA_LEVELS: levels }
  })
  const api = load('aurora', name => {
    if (name === './constants') return { AURORA_LEVELS: levels }
    if (name === './supabase-server') return {}
    if (name === './aurora-completion') return completion
    assert.equal(name, './supabase')
    return { createServiceClient: () => ({ schema: schema => {
      assert.equal(schema, 'mukti')
      return { rpc: async (name, params) => {
        calls.push({ name, params })
        if (reject) throw new Error('Unavailable')
        return { data: reply, error }
      } }
    } }) }
  })
  return { calls, api }
}
const input = () => ({ session_id: '00000000-0000-4000-8000-000000000001', user_id: '00000000-0000-4000-8000-000000000002',
  phases_completed: [{ phase: 'armement', duration_sec: 1, breaths_counted: 0, coherence: null }],
  coherence_score: 1, stopped_reason: 'user_stop', total_duration_sec: 1 })

test('actual dbCompleteSession delegates to the atomic RPC, not separate table writes', async () => {
  const f = fixture({ ok: true, error: null, level_reached: 'brume', streak_days: 1 })
  const result = await f.api.dbCompleteSession(input())
  assert.equal(result.ok, true); assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].name, 'aurora_complete_session_atomic_v1')
  assert.equal(f.calls[0].params.p_user_id, input().user_id)
})
test('actual server helper preserves failed transaction result', async () => {
  const f = fixture(null, { message: 'transaction failed' })
  assert.equal((await f.api.dbCompleteSession(input())).ok, false)
  assert.equal(f.calls.length, 1)
})
test('actual server helper handles a thrown service connection error', async () => {
  const f = fixture(null, null, true)
  assert.equal((await f.api.dbCompleteSession(input())).ok, false)
  assert.equal(f.calls.length, 1)
})
test('actual server helper rejects malformed identifier without contacting database', async () => {
  const f = fixture(null)
  assert.equal((await f.api.dbCompleteSession({ ...input(), session_id: '-'.repeat(36) })).ok, false)
  assert.equal(f.calls.length, 0)
})
