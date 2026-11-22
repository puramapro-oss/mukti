import { beforeEach, expect, it, vi } from 'vitest'

// The actual server helper runs against a scripted PostgREST boundary.
// No provider, database or user account is contacted by these tests.
const state = vi.hoisted(() => ({ reads: [], saved: null, error: null, queries: [], generated: vi.fn() }))
vi.mock('../../src/lib/supabase-server', () => ({ createServerSupabaseClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
  schema: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'profile' } }) }) }) }) }),
}) }))
vi.mock('../../src/lib/supabase', () => ({ createServiceClient: () => ({ schema: () => ({ from: () => {
  const query = { update: null, filters: [] }
  state.queries.push(query)
  const builder = {
    select() { return builder },
    update(value) { query.update = value; return builder },
    eq(key, value) { query.filters.push(['eq', key, value]); return builder },
    is(key, value) { query.filters.push(['is', key, value]); return builder },
    gte() { return builder }, order() { return builder },
    limit: async () => ({ data: [] }),
    maybeSingle: async () => query.update ? { data: state.saved, error: state.error } : { data: state.reads.shift() },
  }
  return builder
} }) }) }))
vi.mock('../../src/lib/claude', () => ({ askClaudeJSON: state.generated }))
import { completeExorcismeSession, generateReprogAffirmation } from '../../src/lib/exorcisme'

const ID = '00000000-0000-4000-8000-000000000001'
const input = { session_id: ID, outcome: 'completed', duration_sec: 12, taps_destruction: 4,
  phases_ms: { invocation: 1000, destruction: 11000 }, sealed: true, affirmation_used: 'Je choisis une autre habitude.' }
const open = () => ({ id: ID, completed_at: null, sensor_data: { possession_text: 'une habitude' } })
const saved = (changes = {}) => ({ id: ID, completed_at: '2026-11-22T00:00:00Z', duration_sec: 12, outcome: 'completed',
  sensor_data: { taps_destruction: 4, phases_ms: input.phases_ms, sealed: true, affirmation_fr: input.affirmation_used }, ...changes })
beforeEach(() => {
  state.reads = [open()]; state.saved = saved(); state.error = null; state.queries = []
  state.generated.mockReset().mockResolvedValue({ fr: 'Je choisis une autre habitude.', en: 'I choose another habit today.' })
})

it('confirms a returned persisted receipt and only updates an unfinished owned ritual', async () => {
  expect((await completeExorcismeSession(input)).ok).toBe(true)
  const update = state.queries.find(query => query.update)
  expect(update.filters).toEqual([['eq', 'id', ID], ['eq', 'user_id', 'profile'], ['eq', 'mode', 'exorcisme'], ['is', 'completed_at', null]])
})

it('does not claim success when the write succeeds with no returned row and no confirmed receipt', async () => {
  state.saved = null
  expect((await completeExorcismeSession(input)).error).toMatch(/non confirmé/i)
})

it('accepts an identical completed receipt without writing again', async () => {
  state.reads = [saved()]
  expect((await completeExorcismeSession(input)).ok).toBe(true)
  expect(state.queries.some(query => query.update)).toBe(false)
})

it('refuses to acknowledge an earlier completion with a different outcome', async () => {
  state.reads = [saved({ outcome: 'interrupted' })]
  expect((await completeExorcismeSession(input)).error).toMatch(/autre résultat/i)
  expect(state.queries.some(query => query.update)).toBe(false)
})

it.each([true, false])('reconciles a concurrent completion only if its receipt matches: %s', async same => {
  state.saved = null
  state.reads = [open(), saved(same ? {} : { duration_sec: 99 })]
  const result = await completeExorcismeSession(input)
  expect(result.ok === true).toBe(same)
})

it('keeps a storage failure explicit', async () => {
  state.error = { message: 'synthetic failure' }
  expect((await completeExorcismeSession(input)).error).toMatch(/enregistrer/i)
})

it('does not generate more guidance for a completed ritual', async () => {
  state.reads = [saved()]
  expect((await generateReprogAffirmation({ session_id: ID, possession_text: 'une habitude' })).error).toMatch(/terminée/)
  expect(state.generated).not.toHaveBeenCalled()
})

it('never lets late generated guidance overwrite a completed session snapshot', async () => {
  state.saved = null
  const result = await generateReprogAffirmation({ session_id: ID, possession_text: 'une habitude' })
  expect(result.error).toMatch(/non enregistrée/)
  const update = state.queries.find(query => query.update)
  expect(update.filters).toContainEqual(['is', 'completed_at', null])
})
