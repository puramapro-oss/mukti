import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMinimalRitualToday, MinimalRitualError, tickHabit, todayStatus } from '../../src/lib/minimal-ritual'

const database = vi.hoisted(() => ({
  auth: vi.fn(),
  profile: vi.fn(),
  profileEq: vi.fn(),
  insert: vi.fn(),
  inserted: vi.fn(),
  existing: vi.fn(),
  eq: vi.fn(),
  summary: vi.fn(),
  service: vi.fn(),
}))

vi.mock('../../src/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(async () => {
    const query = {
      select: vi.fn(() => query),
      eq: database.profileEq.mockImplementation(() => query),
      maybeSingle: database.profile,
    }
    return { auth: { getUser: database.auth }, schema: () => ({ from: () => query }) }
  }),
}))
vi.mock('../../src/lib/supabase', () => ({
  createServiceClient: database.service.mockImplementation(() => {
    const query = {
      insert: database.insert.mockImplementation(() => query),
      select: vi.fn(() => query),
      eq: database.eq.mockImplementation(() => query),
      single: database.inserted,
      maybeSingle: database.existing,
    }
    return { schema: () => ({ from: () => query, rpc: database.summary }) }
  }),
}))

const owner = 'profile-123'
const day = '2026-11-11'
const now = new Date('2026-11-10T23:30:00.000Z')
const habit = 'respiration_consciente'
const stored = (changes: Record<string, unknown> = {}) => ({
  id: 'tick-123', user_id: owner, habit_slug: habit, tick_date: day,
  participation_mode: 'standard', time_zone: 'Europe/Paris', ...changes,
})
const summary = (changes: Record<string, unknown> = {}) => ({
  habit_slug: habit, recorded_today: true, ticked_today: true, mode_today: 'standard',
  progress_days: 9, practice_days: 8, rest_days: 1, streak_days: 2, ...changes,
})

beforeEach(() => {
  vi.clearAllMocks()
  database.auth.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null })
  database.profile.mockResolvedValue({ data: { id: owner }, error: null })
  database.inserted.mockResolvedValue({ data: stored(), error: null })
  database.existing.mockResolvedValue({ data: stored(), error: null })
  database.summary.mockResolvedValue({ data: [summary()], error: null })
})

describe('minimal ritual persistence', () => {
  it.each(['42501', '57014', '08006'])('does not report an insertion error %s as an existing record', async code => {
    database.inserted.mockResolvedValue({ data: null, error: { code, message: 'Private database detail' } })
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(result).toMatchObject({ recorded: false, ticked: false, already: false, status: 503 })
    expect(result.error).not.toContain('Private database detail')
    expect(database.existing).not.toHaveBeenCalled()
    expect(database.summary).not.toHaveBeenCalled()
  })

  it('confirms a unique-conflict retry only after reading the exact owner record', async () => {
    database.inserted.mockResolvedValue({ data: null, error: { code: '23505' } })
    database.existing.mockResolvedValue({ data: stored({ participation_mode: 'rest' }), error: null })
    database.summary.mockResolvedValue({ data: [summary({
      recorded_today: true, ticked_today: false, mode_today: 'rest',
      progress_days: 9, practice_days: 7, rest_days: 2,
    })], error: null })
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(database.eq).toHaveBeenCalledWith('user_id', owner)
    expect(database.eq).toHaveBeenCalledWith('habit_slug', habit)
    expect(database.eq).toHaveBeenCalledWith('tick_date', day)
    expect(result).toMatchObject({
      recorded: true, ticked: false, already: true, participation_mode: 'rest', day, status: 200,
    })
    expect(result.habits?.[0].progress_days).toBe(9)
  })

  it.each([
    null,
    stored({ user_id: 'different-owner' }),
    stored({ habit_slug: 'merci_corps' }),
    stored({ tick_date: '2026-11-10' }),
  ])('does not infer a duplicate from a missing or mismatched conflict record: %j', async record => {
    database.inserted.mockResolvedValue({ data: null, error: { code: '23505' } })
    database.existing.mockResolvedValue({ data: record, error: null })
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(result).toMatchObject({ recorded: false, already: false, status: 503 })
  })

  it('reports a failed owner read after a unique conflict', async () => {
    database.inserted.mockResolvedValue({ data: null, error: { code: '23505' } })
    database.existing.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await tickHabit(habit, 'standard', undefined, now)).toMatchObject({
      recorded: false, already: false, status: 503,
    })
  })

  it('requires an insertion receipt instead of treating a missing row as success', async () => {
    database.inserted.mockResolvedValue({ data: null, error: null })
    expect(await tickHabit(habit, 'standard', undefined, now)).toMatchObject({ recorded: false, status: 503 })
  })

  it('derives the local day on the server, across UTC midnight boundaries', async () => {
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(database.insert).toHaveBeenCalledWith({
      user_id: owner, habit_slug: habit, tick_date: '2026-11-11',
      participation_mode: 'standard', time_zone: 'Europe/Paris',
    })
    expect(result).toMatchObject({ recorded: true, day: '2026-11-11', time_zone: 'Europe/Paris' })
  })

  it('records an adapted participation with its actual mode', async () => {
    database.inserted.mockResolvedValue({ data: stored({ participation_mode: 'adapted' }), error: null })
    database.summary.mockResolvedValue({ data: [summary({ mode_today: 'adapted' })], error: null })
    expect(await tickHabit(habit, 'adapted', undefined, now)).toMatchObject({
      recorded: true, ticked: true, participation_mode: 'adapted', already: false,
    })
    expect(database.insert).toHaveBeenCalledWith(expect.objectContaining({ participation_mode: 'adapted' }))
  })

  it('recognizes rest without claiming a completed exercise', async () => {
    database.inserted.mockResolvedValue({ data: stored({ participation_mode: 'rest' }), error: null })
    database.summary.mockResolvedValue({ data: [summary({
      mode_today: 'rest', ticked_today: false, progress_days: 9, practice_days: 7, rest_days: 2,
    })], error: null })
    const result = await tickHabit(habit, 'rest', undefined, now)
    expect(result).toMatchObject({ recorded: true, ticked: false, participation_mode: 'rest' })
    expect(result.habits?.[0]).toMatchObject({
      recorded_today: true, ticked_today: false, progress_days: 9, practice_days: 7, rest_days: 2,
    })
  })

  it('preserves a confirmed write if only the summary refresh fails', async () => {
    database.summary.mockResolvedValue({ data: null, error: { code: '08006' } })
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(result).toMatchObject({ recorded: true, already: false, error: null, status: 200 })
    expect(result.habits).toBeUndefined()
    expect(result.status_warning).toContain('choix est enregistré')
  })

  it('does not display a contradictory empty summary after a confirmed write', async () => {
    database.summary.mockResolvedValue({ data: [], error: null })
    const result = await tickHabit(habit, 'standard', undefined, now)
    expect(result.recorded).toBe(true)
    expect(result.habits).toBeUndefined()
    expect(result.status_warning).toContain('récapitulatif')
  })

  it('rejects an insertion receipt that contradicts the requested rest mode', async () => {
    const result = await tickHabit(habit, 'rest', undefined, now)
    expect(result).toMatchObject({ recorded: false, ticked: false, status: 503 })
    expect(database.summary).not.toHaveBeenCalled()
  })

  it('does not call the database for an invalid mode or time zone', async () => {
    expect(await tickHabit(habit, 'forced', undefined, now)).toMatchObject({ recorded: false, status: 400 })
    expect(await tickHabit(habit, 'standard', 'Invalid/Zone', now)).toMatchObject({ recorded: false, status: 400 })
    expect(database.auth).not.toHaveBeenCalled()
    expect(database.service).not.toHaveBeenCalled()
  })
})

describe('minimal ritual reads', () => {
  it('reports a profile read failure instead of pretending the profile is absent', async () => {
    database.profile.mockResolvedValue({ data: null, error: { code: '08006' } })
    await expect(todayStatus(undefined, now)).rejects.toMatchObject({ status: 503, message: expect.stringContaining('profil') })
    expect(database.service).not.toHaveBeenCalled()
  })

  it('does not return an empty successful list after a summary failure', async () => {
    database.summary.mockResolvedValue({ data: null, error: { code: '42883' } })
    await expect(todayStatus(undefined, now)).rejects.toBeInstanceOf(MinimalRitualError)
  })

  it('uses the resolved profile, never an auth user id or a supplied owner', async () => {
    const result = await loadMinimalRitualToday(undefined, now)
    expect(database.profileEq).toHaveBeenCalledWith('auth_user_id', 'auth-123')
    expect(database.summary).toHaveBeenCalledWith('minimal_ritual_summary', { p_user_id: owner, p_today: day })
    expect(result.day).toBe(day)
    expect(result.habits).toHaveLength(8)
  })

  it('retains cumulative progress after a gap rather than replacing it with a zero streak', async () => {
    database.summary.mockResolvedValue({ data: [summary({
      mode_today: null, recorded_today: false, ticked_today: false,
      progress_days: 801, practice_days: 800, rest_days: 1, streak_days: 0,
    })], error: null })
    const result = await todayStatus(undefined, now)
    expect(result[0]).toMatchObject({ recorded_today: false, progress_days: 801, streak_days: 0 })
  })

  it('treats an authenticated user without a profile as a distinct error', async () => {
    database.profile.mockResolvedValue({ data: null, error: null })
    await expect(todayStatus(undefined, now)).rejects.toMatchObject({ status: 404 })
  })

  it('requires authentication', async () => {
    database.auth.mockResolvedValue({ data: { user: null }, error: null })
    await expect(todayStatus(undefined, now)).rejects.toMatchObject({ status: 401 })
    expect(database.profile).not.toHaveBeenCalled()
  })

  it('does not invent a normal summary from an invalid or inconsistent result', async () => {
    database.summary.mockResolvedValue({ data: [summary({ mode_today: 'rest', ticked_today: true })], error: null })
    await expect(todayStatus(undefined, now)).rejects.toMatchObject({ status: 503 })
  })

  it('allows an actually empty history to produce eight unrecorded choices', async () => {
    database.summary.mockResolvedValue({ data: [], error: null })
    const result = await todayStatus(undefined, now)
    expect(result).toHaveLength(8)
    expect(result.every(row => !row.recorded_today && !row.ticked_today && row.progress_days === 0)).toBe(true)
  })
})
