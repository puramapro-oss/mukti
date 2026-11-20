import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../../src/app/api/minimal-ritual/tick/route'
import { GET } from '../../src/app/api/minimal-ritual/today/route'

const backend = vi.hoisted(() => {
  class MinimalRitualError extends Error {
    constructor(message: string, public readonly status: number = 503) { super(message) }
  }
  return { auth: vi.fn(), tick: vi.fn(), today: vi.fn(), rate: vi.fn(), MinimalRitualError }
})
vi.mock('../../src/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: backend.auth } })),
}))
vi.mock('../../src/lib/minimal-ritual', () => ({
  tickHabit: backend.tick,
  loadMinimalRitualToday: backend.today,
  MinimalRitualError: backend.MinimalRitualError,
}))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: backend.rate,
  getClientIp: vi.fn(() => 'test-client'),
}))

const body = (json: unknown) => new Request('http://localhost/api/minimal-ritual/tick', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json),
})

beforeEach(() => {
  vi.clearAllMocks()
  backend.auth.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null })
  backend.rate.mockReturnValue({ ok: true })
  backend.tick.mockResolvedValue({
    recorded: true, ticked: true, already: false, error: null, status: 200,
    participation_mode: 'standard', day: '2026-11-11', time_zone: 'Europe/Paris',
  })
  backend.today.mockResolvedValue({ habits: [], day: '2026-11-11', time_zone: 'Europe/Paris' })
})

it('authenticates before validating a malformed tick request', async () => {
  backend.auth.mockResolvedValue({ data: { user: null }, error: null })
  const response = await POST(body({ habit_slug: 'invalid', user_id: 'someone-else' }))
  expect(response.status).toBe(401)
  expect(backend.tick).not.toHaveBeenCalled()
  expect(backend.rate).not.toHaveBeenCalled()
})

it('keeps the server-selected timezone and default participation for legacy requests', async () => {
  const response = await POST(body({ habit_slug: 'respiration_consciente' }))
  expect(response.status).toBe(200)
  expect(backend.tick).toHaveBeenCalledWith('respiration_consciente', 'standard', 'Europe/Paris')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it.each([
  { user_id: 'someone-else' },
  { tick_date: '2099-01-01' },
  { time_zone: 'Pacific/Kiritimati' },
])('rejects a client-controlled owner, date or timezone: %j', async forbidden => {
  const response = await POST(body({ habit_slug: 'respiration_consciente', ...forbidden }))
  expect(response.status).toBe(400)
  expect(backend.tick).not.toHaveBeenCalled()
})

it('preserves rest as recorded but not completed', async () => {
  backend.tick.mockResolvedValue({
    recorded: true, ticked: false, already: false, error: null, status: 200,
    participation_mode: 'rest', day: '2026-11-11', time_zone: 'Europe/Paris',
  })
  const response = await POST(body({ habit_slug: 'respiration_consciente', participation_mode: 'rest' }))
  expect(backend.tick).toHaveBeenCalledWith('respiration_consciente', 'rest', 'Europe/Paris')
  expect(await response.json()).toMatchObject({ recorded: true, ticked: false, participation_mode: 'rest' })
})

it('returns a persistence failure as an unavailable service, not a successful duplicate', async () => {
  backend.tick.mockResolvedValue({
    recorded: false, ticked: false, already: false, error: 'Enregistrement non confirmé.', status: 503,
  })
  const response = await POST(body({ habit_slug: 'respiration_consciente' }))
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ recorded: false, ticked: false, already: false })
})

it('does not return empty successful habits when the read fails', async () => {
  backend.today.mockRejectedValue(new backend.MinimalRitualError('Lecture indisponible.', 503))
  const response = await GET(new Request('http://localhost/api/minimal-ritual/today'))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'Lecture indisponible.' })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it('does not leak infrastructure errors if authentication itself throws', async () => {
  backend.auth.mockRejectedValue(new Error('private database host'))
  const response = await POST(body({ habit_slug: 'respiration_consciente' }))
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('private database host')
  expect(backend.tick).not.toHaveBeenCalled()
})

it('returns the current private read without caching it between users', async () => {
  const response = await GET(new Request('http://localhost/api/minimal-ritual/today'))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ day: '2026-11-11', time_zone: 'Europe/Paris' })
})
