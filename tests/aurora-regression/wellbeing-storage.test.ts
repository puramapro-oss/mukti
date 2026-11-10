import { beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/supabase', () => ({ createServiceClient: () => ({ schema: () => ({ rpc }) }) }))
import { saveWellbeingFeedback } from '../../src/lib/wellbeing'
const input = { session_id: '10000000-0000-4000-8000-000000000001', stage: 'later' as const, feeling: 'worse' as const, discomfort: true, consent: true as const }
beforeEach(() => vi.clearAllMocks())

it.each([null, {}, { already: false }, { already: true, feeling: 'diagnosis', discomfort: false }])('does not acknowledge a missing/invalid receipt: %j', async (data) => {
  rpc.mockResolvedValue({ data, error: null })
  expect(await saveWellbeingFeedback('verified-profile', input)).toMatchObject({ ok: false, status: 503 })
})

it('returns the actual idempotent receipt, without rewriting it to match the submitted form', async () => {
  rpc.mockResolvedValue({ data: { already: true, feeling: 'same', discomfort: false }, error: null })
  expect(await saveWellbeingFeedback('verified-profile', input)).toMatchObject({ ok: true, result: { already: true, feeling: 'same', discomfort: false } })
  expect(rpc).toHaveBeenCalledWith('record_aurora_feedback', expect.objectContaining({ p_user_id: 'verified-profile', p_session_id: input.session_id }))
})

it('keeps ownership/window rejection distinct from persistence failure', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } })
  expect(await saveWellbeingFeedback('verified-profile', input)).toMatchObject({ ok: false, status: 400 })
  rpc.mockResolvedValue({ data: null, error: { code: '08006' } })
  expect(await saveWellbeingFeedback('verified-profile', input)).toMatchObject({ ok: false, status: 503 })
})
