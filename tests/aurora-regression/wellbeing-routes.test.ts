import { beforeEach, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({ profile: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn(), feedback: vi.fn(), record: vi.fn(), resume: vi.fn(), deleteFeedback: vi.fn() }))
vi.mock('../../src/lib/wellbeing-auth', () => ({ wellbeingProfile: deps.profile }))
vi.mock('../../src/lib/wellbeing', () => ({ getWellbeingContext: deps.get, saveWellbeingContext: deps.save, deleteWellbeingContext: deps.remove, getWellbeingFeedback: deps.feedback, saveWellbeingFeedback: deps.record, resumeWellbeingSuggestion: deps.resume, deleteWellbeingFeedback: deps.deleteFeedback }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: () => ({ ok: true }) }))
import * as context from '../../src/app/api/wellbeing/context/route'
import * as feedback from '../../src/app/api/wellbeing/feedback/route'

const body = { physical: 'limited', cognitive: 'available', sensory: 'rest', social: 'rest', minutes: 0, consent: true }
const request = (method: string, value: unknown) => new Request('https://example.test/api/wellbeing/context', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
beforeEach(() => { vi.clearAllMocks(); deps.profile.mockResolvedValue({ id: 'resolved-profile', status: 200 }); deps.save.mockResolvedValue({ context: null }); deps.get.mockResolvedValue({ context: null }) })

it('requires verified authentication before reading or writing sensitive choices', async () => {
  deps.profile.mockResolvedValue({ id: null, status: 401 })
  expect((await context.GET(new Request('https://example.test/api/wellbeing/context'))).status).toBe(401)
  expect((await context.PUT(request('PUT', body))).status).toBe(401)
  expect((await context.DELETE()).status).toBe(401)
  expect((await feedback.GET()).status).toBe(401)
  expect((await feedback.POST(request('POST', {}))).status).toBe(401)
  expect((await feedback.PATCH(request('PATCH', {}))).status).toBe(401)
  expect((await feedback.DELETE()).status).toBe(401)
  expect(deps.save).not.toHaveBeenCalled(); expect(deps.get).not.toHaveBeenCalled(); expect(deps.record).not.toHaveBeenCalled()
})

it('never accepts an identity from the body and does not store choices without consent', async () => {
  expect((await context.PUT(request('PUT', { ...body, user_id: 'victim' }))).status).toBe(400)
  expect((await context.PUT(request('PUT', { ...body, consent: false }))).status).toBe(400)
  expect(deps.save).not.toHaveBeenCalled()
  expect((await context.PUT(request('PUT', body))).status).toBe(200)
  expect(deps.save).toHaveBeenCalledWith('resolved-profile', expect.objectContaining({ minutes: 0, time_zone: 'Europe/Paris' }))
})

it('rejects invalid timezone inputs and sends no-store headers for successful reads', async () => {
  expect((await context.GET(new Request('https://example.test/api/wellbeing/context?time_zone=invalid'))).status).toBe(400)
  const response = await context.GET(new Request('https://example.test/api/wellbeing/context'))
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})

it('keeps storage failures explicit instead of acknowledging a save or deletion', async () => {
  deps.save.mockRejectedValue(new Error('database down'))
  deps.remove.mockRejectedValue(new Error('database down'))
  expect((await context.PUT(request('PUT', body))).status).toBe(503)
  expect((await context.DELETE()).status).toBe(503)
})

it('passes only a validated feedback DTO and preserves failure from the transaction', async () => {
  deps.record.mockResolvedValue({ ok: false, status: 503, error: 'Retour non enregistré.' })
  const input = { session_id: '00000000-0000-4000-8000-000000000001', stage: 'later', feeling: 'worse', discomfort: true, consent: true }
  expect((await feedback.POST(request('POST', input))).status).toBe(503)
  expect(deps.record).toHaveBeenCalledWith('resolved-profile', input)
  expect((await feedback.PATCH(request('PATCH', { variant: 'calm', resume: false }))).status).toBe(400)
})
