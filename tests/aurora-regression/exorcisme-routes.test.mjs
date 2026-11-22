import { beforeEach, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({ getUser: vi.fn(), start: vi.fn(), affirmation: vi.fn(), complete: vi.fn() }))
vi.mock('../../src/lib/supabase-server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: deps.getUser } }) }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: () => ({ ok: true }), getClientIp: () => 'test-ip' }))
vi.mock('../../src/lib/exorcisme', () => ({ startExorcismeSession: deps.start, generateReprogAffirmation: deps.affirmation, completeExorcismeSession: deps.complete }))
import * as start from '../../src/app/api/exorcisme/start/route'
import * as affirmation from '../../src/app/api/exorcisme/affirmation/route'
import * as complete from '../../src/app/api/exorcisme/complete/route'

const ID = '00000000-0000-4000-8000-000000000001'
const request = (body) => new Request('https://example.test/api/exorcisme', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); deps.getUser.mockResolvedValue({ data: { user: { id: 'actor' } } }) })

it('returns the explicit start receipt required by the existing bounded request client', async () => {
  deps.start.mockResolvedValue({ session_id: ID, possession_text: 'une habitude' })
  const result = await start.POST(request({ possession_text: 'une habitude' }))
  expect(result.status).toBe(201)
  expect(await result.json()).toEqual({ ok: true, session_id: ID, possession_text: 'une habitude' })
})

it('returns explicit generated-guidance success while retaining its source', async () => {
  deps.affirmation.mockResolvedValue({ affirmation_fr: 'Je choisis.', affirmation_en: 'I choose.', source: 'fallback' })
  const result = await affirmation.POST(request({ session_id: ID, possession_text: 'une habitude' }))
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ ok: true, affirmation_fr: 'Je choisis.', affirmation_en: 'I choose.', source: 'fallback' })
})

it('does not convert server write errors into success receipts', async () => {
  deps.start.mockResolvedValue({ error: 'Connexion requise.' })
  deps.affirmation.mockResolvedValue({ error: 'Séance introuvable.' })
  deps.complete.mockResolvedValue({ error: 'Impossible d’enregistrer.' })
  const responses = await Promise.all([
    start.POST(request({ possession_text: 'une habitude' })),
    affirmation.POST(request({ session_id: ID, possession_text: 'une habitude' })),
    complete.POST(request({ session_id: ID, outcome: 'completed', duration_sec: 20 })),
  ])
  expect(responses.map(value => value.status)).toEqual([401, 404, 500])
  for (const result of responses) expect((await result.json()).ok).not.toBe(true)
})

it('requires an authenticated user before every ritual operation', async () => {
  deps.getUser.mockResolvedValue({ data: { user: null } })
  for (const route of [start, affirmation, complete]) expect((await route.POST(request({}))).status).toBe(401)
  expect(deps.start).not.toHaveBeenCalled(); expect(deps.affirmation).not.toHaveBeenCalled(); expect(deps.complete).not.toHaveBeenCalled()
})
