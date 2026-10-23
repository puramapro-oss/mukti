import { describe, expect, it, vi } from 'vitest'
import { completeAuroraSession, type AuroraCompletionInput } from '../../src/lib/aurora-completion'

const valid = (): AuroraCompletionInput => ({
  session_id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  phases_completed: [{ phase: 'armement', duration_sec: 2.5, breaths_counted: 1, coherence: null }],
  coherence_score: 0.9,
  stopped_reason: 'user_stop',
  total_duration_sec: 2.5,
})
const success = () => ({ data: { ok: true, error: null, level_reached: 'brume', streak_days: 1 }, error: null })

describe('atomic completion adapter', () => {
  it('uses one parameterized RPC with the authenticated owner and unrounded active time', async () => {
    const rpc = vi.fn(async () => success())
    expect(await completeAuroraSession(rpc, valid())).toEqual({ ok: true, error: null, level_reached: 'brume', streak_days: 1 })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('aurora_complete_session_atomic_v1', {
      p_session_id: valid().session_id, p_user_id: valid().user_id,
      p_phases_completed: valid().phases_completed, p_coherence_score: 0.9,
      p_stopped_reason: 'user_stop', p_total_duration_sec: 2.5,
    })
  })

  const invalidInput: Array<Partial<AuroraCompletionInput>> = [
    { session_id: '../other' }, { user_id: '' }, { session_id: '-'.repeat(36) },
    { total_duration_sec: NaN }, { total_duration_sec: Infinity }, { total_duration_sec: -1 }, { total_duration_sec: 1801 },
    { coherence_score: NaN }, { coherence_score: -1 }, { coherence_score: 2 },
    { phases_completed: [] },
    { phases_completed: [{ phase: 'unknown', duration_sec: 2.5, breaths_counted: 1, coherence: null }] },
    { phases_completed: [{ phase: 'armement', duration_sec: 2.5, breaths_counted: -1, coherence: null }] },
    { phases_completed: [{ phase: 'armement', duration_sec: 2.5, breaths_counted: 0.5, coherence: null }] },
    { phases_completed: [{ phase: 'armement', duration_sec: NaN, breaths_counted: 1, coherence: null }] },
    { phases_completed: [{ phase: 'armement', duration_sec: 2.5, breaths_counted: 1, coherence: Infinity }] },
    { total_duration_sec: 100 },
  ]
  it.each(invalidInput)('rejects invalid input before any write: %j', async (change) => {
    const rpc = vi.fn(async () => success())
    const result = await completeAuroraSession(rpc, { ...valid(), ...change })
    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([null, undefined, [], {}, { ok: true }, { ok: 'true' },
    { ok: true, level_reached: 'invented', streak_days: 1 },
    { ok: true, level_reached: 'brume', streak_days: NaN },
    { ok: true, level_reached: 'brume', streak_days: -1 },
    { ok: true, level_reached: 'brume', streak_days: 0.5 },
    { ok: true, level_reached: 'brume', streak_days: 0 },
    { ok: true, level_reached: 'brume', streak_days: 1, error: 'partial write' },
  ])('rejects malformed or contradictory database result: %j', async (data) => {
    const rpc = vi.fn(async () => ({ data, error: null }))
    expect((await completeAuroraSession(rpc, valid())).ok).toBe(false)
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('does not turn a failed transaction into a successful save', async () => {
    const rpc = vi.fn(async () => ({ ...success(), error: { message: 'streak update failed' } }))
    expect(await completeAuroraSession(rpc, valid())).toEqual({ ok: false, error: 'Enregistrement non confirmé. Réessaie.', level_reached: null, streak_days: 0 })
    expect(rpc).toHaveBeenCalledOnce()
  })
  it('missing migration does not trigger unsafe fallback writes', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202' } }))
    expect((await completeAuroraSession(rpc, valid())).ok).toBe(false)
    expect(rpc).toHaveBeenCalledOnce()
  })
  it('network failure is not automatically retried', async () => {
    const rpc = vi.fn(async () => { throw new Error('connection lost') })
    expect((await completeAuroraSession(rpc, valid())).ok).toBe(false)
    expect(rpc).toHaveBeenCalledOnce()
  })
  it.each(['Session introuvable.', 'Session déjà complétée.'])('preserves safe domain error: %s', async (error) => {
    const result = await completeAuroraSession(async () => ({ data: { ok: false, error }, error: null }), valid())
    expect(result.error).toBe(error)
    expect(result.ok).toBe(false)
  })
  it('does not disclose unexpected database details', async () => {
    const result = await completeAuroraSession(async () => ({ data: { ok: false, error: 'internal database details' }, error: null }), valid())
    expect(result.error).toBe('Enregistrement non confirmé. Réessaie.')
  })
  it('accepts the existing 0.1-second partial-phase rounding', async () => {
    const value = valid(); value.total_duration_sec = 2.549
    expect((await completeAuroraSession(async () => success(), value)).ok).toBe(true)
  })
})
