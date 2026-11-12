import { beforeEach, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({ client: vi.fn(), score: vi.fn(), rate: vi.fn(), ip: vi.fn() }))
vi.mock('../../src/lib/supabase-server', () => ({ createServerSupabaseClient: dependencies.client }))
vi.mock('../../src/lib/trust', () => ({ recomputeTrustScore: dependencies.score }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: dependencies.rate, getClientIp: dependencies.ip }))
import { POST } from '../../src/app/api/mode-sessions/log/route'

const ID = '00000000-0000-4000-8000-000000000001'
const ADDICTION = '00000000-0000-4000-8000-000000000002'
const PROFILE = '00000000-0000-4000-8000-000000000003'
type Row = Record<string, unknown>
type Query = { table: string; filters: Record<string, unknown>; inserted?: Row }
const body = (changes: Row = {}) => ({
  client_session_id: ID, mode: 'multisensoriel', addiction_id: ADDICTION,
  started_at: '2026-11-12T08:00:00.000Z', completed_at: '2026-11-12T08:00:30.000Z',
  duration_sec: 30, urge_before: 8, urge_after: 4, outcome: 'completed', ...changes,
})
const request = (value: unknown) => new Request('https://example.test/api/mode-sessions/log', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
})

// Explicit Supabase double: it models the existing unique ID and owner-filtered
// reads for route behavior. It is not a database, RLS or concurrent-SQL test.
function database() {
  const rows = new Map<string, Row>()
  const queries: Query[] = []
  const state = {
    user: { id: 'authenticated-user' } as { id: string } | null,
    profile: { id: PROFILE } as { id: string } | null,
    addictionAvailable: true, exposeForeignRow: false,
    insertError: null as { code: string; message: string } | null,
    readError: null as { message: string } | null,
  }
  let next = 10
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
    from: vi.fn((table: string) => {
      const query: Query = { table, filters: {} }
      queries.push(query)
      const builder = {
        select: vi.fn((_columns: string) => builder),
        eq: vi.fn((key: string, value: unknown) => { query.filters[key] = value; return builder }),
        insert: vi.fn((value: Row) => { query.inserted = value; return builder }),
        single: vi.fn(async () => {
          if (state.insertError) return { data: null, error: state.insertError }
          const id = String(query.inserted?.id ?? `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`)
          if (rows.has(id)) return { data: null, error: { code: '23505', message: 'unique violation with private details' } }
          const saved = { ...query.inserted, id }
          rows.set(id, saved)
          return { data: saved, error: null }
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'profiles') return { data: state.profile, error: null }
          if (table === 'addictions') return { data: state.addictionAvailable ? { id: ADDICTION } : null, error: null }
          if (state.readError) return { data: null, error: state.readError }
          const row = rows.get(String(query.filters.id))
          const visible = row && (state.exposeForeignRow || Object.entries(query.filters).every(([key, value]) => row[key] === value))
          return { data: visible ? row : null, error: null }
        }),
      }
      return builder
    }),
  }
  return { client, rows, queries, state }
}
let db: ReturnType<typeof database>
beforeEach(() => {
  vi.clearAllMocks()
  db = database()
  dependencies.client.mockResolvedValue(db.client)
  dependencies.score.mockResolvedValue({})
  dependencies.rate.mockReturnValue({ ok: true })
  dependencies.ip.mockReturnValue('192.0.2.1')
})

it('inserts the client ID in the existing table with the authenticated profile, never an injected owner', async () => {
  const result = await POST(request(body({ user_id: 'injected-owner' })))
  expect(result.status).toBe(201)
  expect(result.headers.get('Cache-Control')).toBe('no-store')
  expect(db.rows.get(ID)).toMatchObject({ id: ID, user_id: PROFILE, mode: 'multisensoriel', outcome: 'completed' })
  expect(dependencies.score).toHaveBeenCalledExactlyOnceWith(PROFILE)
  expect(db.queries.find(query => query.table === 'profiles')?.filters).toEqual({ auth_user_id: 'authenticated-user' })
})

it('preserves the optional-ID legacy route without promising idempotency for those callers', async () => {
  const result = await POST(request({ mode: 'micro_meditation' }))
  expect(result.status).toBe(201)
  const row = Array.from(db.rows.values())[0]
  expect(row.id).toBeTruthy()
  expect(row.completed_at).toBeNull()
  expect(db.queries.find(query => query.inserted)?.inserted).not.toHaveProperty('id')
})

it.each([
  body({ client_session_id: 'invalid' }),
  body({ started_at: undefined }),
  body({ mode: 'unrecognized' }),
  body({ duration_sec: 3601 }),
  body({ urge_after: 11 }),
])('rejects a malformed retry contract without inserting a row', async value => {
  expect((await POST(request(value))).status).toBe(400)
  expect(db.rows.size).toBe(0)
  expect(dependencies.score).not.toHaveBeenCalled()
})

it('returns the same row after a lost response, accepting JSONB order and database timestamp formatting', async () => {
  const payload = body({ sensor_data: { label: 'fixture', nested: { left: 1, right: 2 } } })
  expect((await POST(request(payload))).status).toBe(201)
  const row = Array.from(db.rows.values())[0]
  row.started_at = '2026-11-12T08:00:00+00:00'
  row.completed_at = '2026-11-12T08:00:30+00:00'
  row.sensor_data = { nested: { right: 2, left: 1 }, label: 'fixture' }
  dependencies.ip.mockReturnValue('192.0.2.2')
  const retry = await POST(request(payload))
  expect(retry.status).toBe(200)
  expect(await retry.json()).toMatchObject({ ok: true, replayed: true, session: { id: ID } })
  expect(db.rows.size).toBe(1)
  expect(dependencies.score).toHaveBeenCalledTimes(1)
  expect(db.queries.filter(query => query.table === 'mode_sessions' && !query.inserted).at(-1)?.filters)
    .toEqual({ id: ID, user_id: PROFILE })
})

it.each([
  { mode: 'micro_meditation' }, { addiction_id: '00000000-0000-4000-8000-000000000099' },
  { started_at: '2026-11-12T08:00:01.000Z' }, { completed_at: '2026-11-12T08:00:31.000Z' },
  { duration_sec: 31 }, { urge_before: 7 }, { urge_after: 5 }, { outcome: 'resisted' },
  { sensor_data: { another: true } }, { client_fingerprint: 'different' },
])('rejects a collision with changed payload %j without overwriting or recalculating', async change => {
  await POST(request(body()))
  const original = structuredClone(db.rows.get(ID))
  const result = await POST(request(body(change)))
  expect(result.status).toBe(409)
  expect(await result.json()).toEqual({
    error: 'Enregistrement non confirmé : cet identifiant de séance ne peut pas être réutilisé avec ces données.',
  })
  expect(db.rows.get(ID)).toEqual(original)
  expect(dependencies.score).toHaveBeenCalledTimes(1)
})

it.each([false, true])('does not reveal or acknowledge another owner’s row (bypassed RLS double: %s)', async exposeForeignRow => {
  await POST(request(body()))
  const row = db.rows.get(ID)!
  row.user_id = 'another-private-profile'
  row.sensor_data = { privateValue: 'must-not-be-returned' }
  db.state.exposeForeignRow = exposeForeignRow
  const result = await POST(request(body()))
  expect(result.status).toBe(409)
  const serialized = await result.text()
  expect(serialized).not.toContain('another-private-profile')
  expect(serialized).not.toContain('must-not-be-returned')
  expect(serialized).not.toContain('session')
  expect(dependencies.score).toHaveBeenCalledTimes(1)
})

it('handles simultaneous duplicate attempts through the existing primary-key conflict', async () => {
  const results = await Promise.all([POST(request(body())), POST(request(body()))])
  expect(results.map(result => result.status).sort()).toEqual([200, 201])
  expect(db.rows.size).toBe(1)
  expect(dependencies.score).toHaveBeenCalledTimes(1)
})

it('normalizes UUID casing and time precision consistently before an idempotent insert', async () => {
  const uuid = 'abcdefab-abcd-4abc-8abc-abcdefabcdef'
  const payload = body({ client_session_id: uuid.toUpperCase(), started_at: '2026-11-12T08:00:00.000000Z' })
  expect((await POST(request(payload))).status).toBe(201)
  expect(db.rows.has(uuid)).toBe(true)
  expect((await POST(request({ ...payload, client_session_id: uuid, started_at: '2026-11-12T08:00:00Z' }))).status).toBe(200)
})

it('keeps uncertain storage results explicit without leaking database messages', async () => {
  db.state.insertError = { code: 'XX000', message: 'private connection and payload details' }
  const result = await POST(request(body()))
  expect(result.status).toBe(503)
  expect(await result.text()).not.toContain('private')
  expect(dependencies.score).not.toHaveBeenCalled()
})

it('does not acknowledge a duplicate when reading the existing row fails', async () => {
  await POST(request(body()))
  db.state.readError = { message: 'read unavailable' }
  expect((await POST(request(body()))).status).toBe(503)
  expect(dependencies.score).toHaveBeenCalledTimes(1)
})

it('contains thrown infrastructure failures in a nonconfirming response', async () => {
  dependencies.client.mockRejectedValue(new Error('private infrastructure information'))
  const result = await POST(request(body()))
  expect(result.status).toBe(503)
  expect(await result.text()).not.toContain('private')
})

it('preserves authentication, profile and addiction checks before any insertion', async () => {
  db.state.user = null
  expect((await POST(request(body()))).status).toBe(401)
  expect(db.client.from).not.toHaveBeenCalled()
  db.state.user = { id: 'authenticated-user' }
  db.state.profile = null
  expect((await POST(request(body()))).status).toBe(404)
  db.state.profile = { id: PROFILE }
  db.state.addictionAvailable = false
  expect((await POST(request(body()))).status).toBe(404)
  expect(db.rows.size).toBe(0)
})

it('preserves rate limiting and its Retry-After header', async () => {
  dependencies.rate.mockReturnValue({ ok: false, retryAfterSec: 20 })
  const result = await POST(request(body()))
  expect(result.status).toBe(429)
  expect(result.headers.get('Retry-After')).toBe('20')
  expect(db.rows.size).toBe(0)
})
