import { beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({ client: vi.fn(), auth: vi.fn(), limiter: vi.fn(), schema: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }))
vi.mock('../../src/lib/supabase-server', () => ({ createServerSupabaseClient: deps.client }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: deps.limiter }))
import { GET } from '../../src/app/api/affirmations/widget/route'

const uuid = '00000000-0000-4000-8000-000000000001'
const request = (query = '') => new Request(`https://mukti.purama.dev/api/affirmations/widget${query}`)
const chain = { schema: deps.schema, from: deps.from, select: deps.select, eq: deps.eq, order: deps.order, limit: deps.limit }

beforeEach(() => {
  vi.clearAllMocks()
  deps.client.mockResolvedValue({ ...chain, auth: { getUser: deps.auth } })
  deps.auth.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null })
  deps.limiter.mockReturnValue({ ok: true })
  for (const method of ['schema', 'from', 'select', 'eq', 'order'] as const) deps[method].mockReturnValue(chain)
  deps.limit.mockResolvedValue({ data: [{ id: uuid, source: 'purama', text_fr: 'Je respire à mon rythme.', text_en: 'I breathe at my own pace.' }], error: null })
})

describe('authenticated public-catalogue API', () => {
  it('reads only active first-party rows through the authenticated client, with stable order and a bounded query', async () => {
    const response = await GET(request('?category=paix&locale=fr&user_id=someone-else'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ ok: true, items: [{ id: uuid, text: 'Je respire à mon rythme.' }] })
    expect(deps.auth).toHaveBeenCalledOnce()
    expect(deps.limiter).toHaveBeenCalledWith('affirmation-widget:verified-user', 120, 3600)
    expect(deps.schema).toHaveBeenCalledWith('mukti')
    expect(deps.from.mock.calls).toEqual([['affirmations']])
    expect(deps.select).toHaveBeenCalledWith('id, source, text_fr, text_en')
    expect(deps.eq.mock.calls).toEqual([['active', true], ['source', 'purama'], ['category', 'paix']])
    expect(deps.order).toHaveBeenCalledWith('id', { ascending: true })
    expect(deps.limit).toHaveBeenCalledWith(500)
  })

  it('defaults category and language without another content service', async () => {
    expect((await GET(request())).status).toBe(200)
    expect(deps.eq).toHaveBeenCalledWith('category', 'paix')
    const english = await GET(request('?category=confiance&locale=en'))
    expect(await english.json()).toEqual({ ok: true, items: [{ id: uuid, text: 'I breathe at my own pace.' }] })
  })

  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { status: 401 } },
    { data: { user: { id: 'untrusted' } }, error: { status: 401 } },
  ])('requires verified auth before catalogue query', async auth => {
    deps.auth.mockResolvedValue(auth)
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(deps.from).not.toHaveBeenCalled()
    expect(deps.limiter).not.toHaveBeenCalled()
    expect((await response.json()).ok).toBe(false)
  })

  it('reports an auth service outage separately from signed-out state', async () => {
    deps.auth.mockResolvedValue({ data: { user: null }, error: { status: 503 } })
    expect((await GET(request())).status).toBe(503)
    expect(deps.from).not.toHaveBeenCalled()
  })

  it('returns a retry header and performs no query when throttled', async () => {
    deps.limiter.mockReturnValue({ ok: false, retryAfterSec: 21 })
    const response = await GET(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('21')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(deps.from).not.toHaveBeenCalled()
  })

  it.each(['?category=unknown', '?category=', '?locale=xx', '?locale='])('rejects invalid choices before querying (%s)', async query => {
    const response = await GET(request(query))
    expect(response.status).toBe(400)
    expect(deps.from).not.toHaveBeenCalled()
    expect((await response.json()).ok).toBe(false)
  })

  it('preserves a truthful empty catalogue and filters private rows defensively', async () => {
    deps.limit.mockResolvedValue({ data: [{ id: uuid, source: 'user', text_fr: 'Texte privé.' }], error: null })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, items: [] })
  })

  it('returns 503 without internal SQL details on a database failure', async () => {
    deps.limit.mockResolvedValue({ data: null, error: { message: 'secret database name' } })
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).not.toContain('secret')
  })

  it('does not confuse an unexpected transport error with an empty successful catalogue', async () => {
    deps.client.mockRejectedValue(new Error('offline secret'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect((await response.json()).ok).toBe(false)
  })
})
