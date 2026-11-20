import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isDailyRecognition,
  isRecognitionDate,
  mergeRecognitionHistory,
  recognitionHistoryLimit,
  utcRecognitionDate,
} from '../../src/lib/daily-recognition'
import { claimDailyChest, getRecognitionOverview, listRewards } from '../../src/lib/mystery-rewards'

type DbResult = { data: unknown; error: { message: string } | null }
const db = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  filters: [] as Array<[string, string, unknown]>,
  limits: [] as Array<[string, number]>,
  results: {} as Record<string, DbResult>,
}))

vi.mock('../../src/lib/supabase-server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: db.auth },
    schema: () => ({ from: (table: string) => ({
      select: () => ({ eq: (key: string, value: unknown) => {
        db.filters.push([table, key, value])
        return { maybeSingle: db.profile }
      } }),
    }) }),
  }),
}))
vi.mock('../../src/lib/supabase', () => ({
  createServiceClient: () => ({ schema: () => ({ rpc: db.rpc, from: db.from }) }),
}))

const recognition = {
  id: '11111111-1111-4111-8111-111111111111',
  recognition_date: '2026-11-10',
  recognized_at: '2026-11-10T12:00:00.000Z',
}
const legacy = {
  id: '22222222-2222-4222-8222-222222222222',
  claim_date: '2026-10-01', tier: 'rare', reward_type: 'points', reward_amount: 150,
  streak_day: 7, claimed_at: '2026-10-01T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'))
  db.filters.length = 0
  db.limits.length = 0
  db.auth.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null })
  db.profile.mockResolvedValue({ data: { id: 'resolved-profile' }, error: null })
  db.rpc.mockResolvedValue({ data: { recognition, already_recorded: false }, error: null })
  db.results = {
    daily_recognitions: { data: [recognition], error: null },
    mystery_rewards: { data: [legacy], error: null },
  }
  db.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { db.filters.push([table, key, value]); return query },
      order: () => query,
      limit: async (limit: number) => { db.limits.push([table, limit]); return db.results[table] },
    }
    return query
  })
})

describe('daily recognition persistence', () => {
  it('binds the authenticated profile and sends no amount, activity or client date', async () => {
    await expect(claimDailyChest()).resolves.toEqual({ recognition, alreadyClaimed: false })
    expect(db.filters).toEqual([['profiles', 'auth_user_id', 'auth-user']])
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('record_daily_recognition', { p_profile_id: 'resolved-profile' })
    expect(db.from).not.toHaveBeenCalled() // No profile balance, legacy receipt or wallet write.
  })

  it('preserves the database receipt and duplicate flag on a retry', async () => {
    db.rpc.mockResolvedValue({ data: { recognition, already_recorded: true }, error: null })
    await expect(claimDailyChest()).resolves.toEqual({ recognition, alreadyClaimed: true })
    expect(db.from).not.toHaveBeenCalled()
  })

  it('does not reach the service RPC without an authenticated user', async () => {
    db.auth.mockResolvedValue({ data: { user: null }, error: null })
    await expect(claimDailyChest()).rejects.toMatchObject({ status: 401 })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('does not turn a profile query failure into a success', async () => {
    db.profile.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })
    await expect(claimDailyChest()).rejects.toMatchObject({ status: 503 })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('does not invent a recognition when the RPC or migration is unavailable', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'function unavailable' } })
    await expect(claimDailyChest()).rejects.toMatchObject({ status: 503 })
    expect(db.from).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { recognition: null, already_recorded: false },
    { recognition, already_recorded: 'yes' },
    { recognition: { ...recognition, recognized_at: '2026-11-09T23:59:59Z' }, already_recorded: false },
  ])('rejects an unconfirmed RPC result: %j', async data => {
    db.rpc.mockResolvedValue({ data, error: null })
    await expect(claimDailyChest()).rejects.toMatchObject({ status: 503 })
  })
})

describe('unchanged legacy receipts and honest history', () => {
  it('preserves legacy amounts and describes delivery as unknown without mutating the row', async () => {
    const snapshot = { ...legacy }
    const history = await listRewards()
    expect(history).toEqual([{ ...snapshot, delivery_status: 'unknown' }])
    expect(legacy).toEqual(snapshot)
    expect(legacy).not.toHaveProperty('delivery_status')
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.filters).toContainEqual(['mystery_rewards', 'user_id', 'resolved-profile'])
  })

  it('keeps a legacy failure visible instead of returning an empty successful history', async () => {
    db.results.mystery_rewards = { data: null, error: { message: 'read failed' } }
    await expect(listRewards()).rejects.toMatchObject({ status: 503 })
    await expect(getRecognitionOverview()).rejects.toMatchObject({ status: 503 })
  })

  it('keeps a recognition history failure visible', async () => {
    db.results.daily_recognitions = { data: null, error: { message: 'missing migration' } }
    await expect(getRecognitionOverview()).rejects.toMatchObject({ status: 503 })
  })

  it('reads both histories for the resolved profile and preserves their different meanings', async () => {
    const history = await getRecognitionOverview(14.9)
    expect(history.today).toBe('2026-11-10')
    expect(history.recognition).toEqual(recognition)
    expect(history.recognitions).toEqual([recognition])
    expect(history.legacy_rewards[0].delivery_status).toBe('unknown')
    expect(db.limits).toEqual([['daily_recognitions', 14], ['mystery_rewards', 14]])
    expect(db.filters).toContainEqual(['daily_recognitions', 'user_id', 'resolved-profile'])
  })
})

describe('calendar and repeatable client contract', () => {
  it.each([
    ['2026-11-10T00:30:00+14:00', '2026-11-09'],
    ['2026-11-10T23:30:00-12:00', '2026-11-11'],
    ['2026-03-29T03:00:00+02:00', '2026-03-29'],
    ['2026-10-25T02:30:00+01:00', '2026-10-25'],
    ['2026-11-10T23:59:59.999Z', '2026-11-10'],
    ['2026-11-11T00:00:00.000Z', '2026-11-11'],
  ])('uses the same UTC day for %s', (instant, expected) => {
    expect(utcRecognitionDate(new Date(instant))).toBe(expected)
  })

  it('does not accept impossible dates or a timestamp from a different day', () => {
    expect(isRecognitionDate('2026-02-30')).toBe(false)
    expect(isRecognitionDate('2026-13-01')).toBe(false)
    expect(isDailyRecognition({ ...recognition, recognized_at: 'invalid' })).toBe(false)
  })

  it('deduplicates a repeated acknowledgement without losing older spaced entries', () => {
    const previous = { ...recognition, id: 'previous', recognition_date: '2026-10-01', recognized_at: '2026-10-01T12:00:00Z' }
    expect(mergeRecognitionHistory([previous, recognition], recognition)).toEqual([recognition, previous])
  })

  it.each([[NaN, 14], [Infinity, 14], [-20, 1], [1.9, 1], [1000, 60]])('bounds the history limit %s', (input, expected) => {
    expect(recognitionHistoryLimit(input)).toBe(expected)
  })
})
