import { beforeEach, expect, it, vi } from 'vitest'
import { normalizeTimeZone, localDay, shiftDay } from '../../src/lib/wellbeing-date'
import { WellbeingInput, FeedbackInput, availableAuroraVariants, shouldPauseSuggestion, type WellbeingContext } from '../../src/lib/wellbeing-state'
import { wellbeingRequest } from '../../src/lib/wellbeing-request'

const base: WellbeingContext = {
  day: '2026-11-10', updated_at: '2026-11-10T10:00:00Z', time_zone: 'Europe/Paris',
  physical: 'available', cognitive: 'available', sensory: 'limited', social: 'rest', minutes: 5,
}

beforeEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it.each([
  ['2026-03-28T23:30:00Z', 'Europe/Paris', '2026-03-29'],
  ['2026-03-29T22:30:00Z', 'Europe/Paris', '2026-03-30'],
  ['2026-10-25T00:30:00Z', 'Europe/Paris', '2026-10-25'],
  ['2026-10-25T23:30:00Z', 'Europe/Paris', '2026-10-26'],
  ['2026-11-10T12:30:00Z', 'Pacific/Kiritimati', '2026-11-11'],
  ['2026-11-10T08:30:00Z', 'Pacific/Honolulu', '2026-11-09'],
])('uses calendar days across time zones/DST: %s %s', (time, zone, day) => {
  expect(localDay(new Date(time), zone)).toBe(day)
})

it('rejects invalid time zones and dates; moves calendar days without DST arithmetic', () => {
  expect(normalizeTimeZone(undefined)).toBe('Europe/Paris')
  expect(() => normalizeTimeZone('Paris invented')).toThrow()
  expect(() => shiftDay('2026-02-30', 1)).toThrow()
  expect(shiftDay('2026-03-29', -1)).toBe('2026-03-28')
})

it('requires explicit consent and rejects identities/unknown fields/invalid availability', () => {
  const { day: _day, updated_at: _updated, ...input } = base
  expect(WellbeingInput.safeParse({ ...input, consent: true }).success).toBe(true)
  expect(WellbeingInput.safeParse({ ...input, consent: false }).success).toBe(false)
  expect(WellbeingInput.safeParse({ ...input, consent: true, user_id: 'other' }).success).toBe(false)
  expect(WellbeingInput.safeParse({ ...input, consent: true, minutes: -1 }).success).toBe(false)
  expect(WellbeingInput.safeParse({ ...input, consent: true, physical: 'god' }).success).toBe(false)
})

it('does not infer availability, requires enough actual seconds, and honors suggestion pauses', () => {
  expect(availableAuroraVariants(null, [])).toEqual([])
  expect(availableAuroraVariants({ ...base, minutes: 2 }, [])).toEqual([]) // Ignite is 128s, not 120s.
  expect(availableAuroraVariants(base, [])).toEqual(['focus', 'ignite'])
  expect(availableAuroraVariants(base, ['focus'])).toEqual(['ignite'])
  expect(availableAuroraVariants({ ...base, physical: 'rest' }, [])).toEqual([])
  expect(availableAuroraVariants({ ...base, cognitive: 'rest' }, [])).toEqual([])
  expect(availableAuroraVariants({ ...base, minutes: 0 }, [])).toEqual([])
})

it('treats negative reports and discomfort as reasons to pause, never as diagnoses', () => {
  expect(shouldPauseSuggestion({ feeling: 'worse', discomfort: false })).toBe(true)
  expect(shouldPauseSuggestion({ feeling: 'better', discomfort: true })).toBe(true)
  expect(shouldPauseSuggestion({ feeling: 'unsure', discomfort: false })).toBe(false)
  expect(FeedbackInput.safeParse({ session_id: 'bogus', stage: 'later', feeling: 'better', discomfort: false, consent: true }).success).toBe(false)
})

it.each([{ ok: false }, null, []])('does not acknowledge malformed or unsuccessful replies: %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))))
  await expect(wellbeingRequest('/api/wellbeing/context')).rejects.toThrow()
})

it('rejects a response received after timeout, even if the transport ignores cancellation', async () => {
  vi.useFakeTimers()
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolve = done })))
  const request = wellbeingRequest('/api/wellbeing/context', { method: 'PUT' })
  const rejected = expect(request).rejects.toThrow('non confirmé')
  await vi.advanceTimersByTimeAsync(10_000)
  resolve(new Response(JSON.stringify({ ok: true })))
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})
