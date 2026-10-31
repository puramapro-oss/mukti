/** Exercise actual middleware with explicit authentication and Next response doubles. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const ts = createRequire(import.meta.url)(process.env.MUKTI_TYPESCRIPT_PATH || 'typescript')
const source = fs.readFileSync(new URL('../../src/middleware.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function fixture(user = null) {
  const calls = [], exports = {}
  const next = () => ({ action: 'next', cookies: { set() {} } })
  vm.runInNewContext(code, { exports, URL, process: { env: {} }, require(name) {
    if (name === 'next/server') return { NextResponse: { next, redirect: url => ({ action: 'redirect', url: String(url) }) } }
    assert.equal(name, '@supabase/ssr')
    return { createServerClient() { calls.push('create'); return { auth: { getUser: async () => { calls.push('auth'); return { data: { user } } } } } } }
  } })
  return { calls, async request(path) { return exports.middleware({ nextUrl: new URL(path, 'https://mukti.test'), url: new URL(path, 'https://mukti.test').href, cookies: { getAll: () => [], set() {} } }) } }
}

test('exact public tone page makes no authentication or database call', async () => {
  const f = fixture(); assert.equal((await f.request('/frequences')).action, 'next'); assert.deepEqual(f.calls, [])
})
for (const path of ['/dashboard', '/frequences/private', '/frequences-admin', '/frequences-old']) {
  test(`public tone exception does not bypass private path ${path}`, async () => {
    const f = fixture(); const response = await f.request(path)
    assert.equal(response.action, 'redirect'); assert.equal(new URL(response.url).pathname, '/login'); assert.equal(new URL(response.url).searchParams.get('next'), path)
    assert.deepEqual(f.calls, ['create', 'auth'])
  })
}
test('authenticated existing dashboard access still works', async () => {
  const f = fixture({ id: 'existing-user' }); assert.equal((await f.request('/dashboard')).action, 'next'); assert.deepEqual(f.calls, ['create', 'auth'])
})
test('existing login redirect for an authenticated user is unchanged', async () => {
  const f = fixture({ id: 'existing-user' }); const response = await f.request('/login')
  assert.equal(response.action, 'redirect'); assert.equal(new URL(response.url).pathname, '/dashboard')
})
