import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../src/app/api/mystery-rewards/claim-daily/route'
import { GET } from '../../src/app/api/mystery-rewards/history/route'
import { RecognitionError } from '../../src/lib/mystery-rewards'
import { RECOGNITION_FORMAT } from '../../src/lib/daily-recognition'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), claim: vi.fn(), overview: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.auth } }),
}))
vi.mock('@/lib/mystery-rewards', () => ({
  claimDailyChest: mocks.claim,
  getRecognitionOverview: mocks.overview,
  RecognitionError: class extends Error {
    constructor(message: string, public status = 503) { super(message) }
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rate, getClientIp: () => '127.0.0.1' }))

const recognition = {
  id: '11111111-1111-4111-8111-111111111111',
  recognition_date: '2026-11-10', recognized_at: '2026-11-10T12:00:00.000Z',
}
const overview = {
  format: RECOGNITION_FORMAT, time_zone: 'UTC', today: '2026-11-10',
  recognition, recognitions: [recognition], legacy_rewards: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ data: { user: { id: 'authenticated-user' } }, error: null })
  mocks.rate.mockReturnValue({ ok: true, retryAfterSec: 0 })
  mocks.claim.mockResolvedValue({ recognition, alreadyClaimed: false })
  mocks.overview.mockResolvedValue(overview)
})

describe('compatible daily-recognition HTTP routes', () => {
  it('authenticates before processing a write or consulting its request body', async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    const result = await POST(new Request('https://example.test/api/mystery-rewards/claim-daily', {
      method: 'POST', body: '{invalid-json',
    }))
    expect(result.status).toBe(401)
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.rate).not.toHaveBeenCalled()
  })

  it('ignores client identity, amounts and dates and never returns a fake financial reward', async () => {
    const result = await POST(new Request('https://example.test/api/mystery-rewards/claim-daily', {
      method: 'POST', body: JSON.stringify({ user_id: 'someone-else', amount: 1000000, date: '2099-01-01' }),
    }))
    expect(result.status).toBe(200)
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith()
    expect(await result.json()).toMatchObject({
      ok: true, format: RECOGNITION_FORMAT, recognition,
      already_recorded: false, reward: null, financial_value: false,
    })
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('returns an unavailable error when persistence fails', async () => {
    mocks.claim.mockRejectedValue(new RecognitionError('Enregistrement indisponible.', 503))
    const result = await POST(new Request('https://example.test/api/mystery-rewards/claim-daily', { method: 'POST' }))
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ error: 'Enregistrement indisponible.' })
  })

  it('retains the already_claimed compatibility flag without a second benefit', async () => {
    mocks.claim.mockResolvedValue({ recognition, alreadyClaimed: true })
    const result = await POST(new Request('https://example.test/api/mystery-rewards/claim-daily', { method: 'POST' }))
    expect(await result.json()).toMatchObject({ recognition, already_recorded: true, already_claimed: true, reward: null })
  })

  it('keeps history private and includes unchanged legacy receipts under the compatibility key', async () => {
    const result = await GET(new Request('https://example.test/api/mystery-rewards/history?limit=14'))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ ok: true, ...overview, rewards: overview.legacy_rewards })
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.overview).toHaveBeenCalledExactlyOnceWith(14)
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('does not replace a history query failure with an empty success', async () => {
    mocks.overview.mockRejectedValue(new RecognitionError('Historique indisponible.'))
    const result = await GET(new Request('https://example.test/api/mystery-rewards/history'))
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ error: 'Historique indisponible.' })
  })
})
