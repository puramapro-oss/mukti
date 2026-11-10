/** Calendar dates only; never use these values as a physiological measurement. */
export const DEFAULT_WELLBEING_TIME_ZONE = 'Europe/Paris'

export function normalizeTimeZone(input: unknown): string {
  if (input === undefined || input === null || input === '') return DEFAULT_WELLBEING_TIME_ZONE
  if (typeof input !== 'string' || input.length > 80) throw new Error('Fuseau horaire invalide.')
  try {
    return new Intl.DateTimeFormat('en', { timeZone: input }).resolvedOptions().timeZone
  } catch {
    throw new Error('Fuseau horaire invalide.')
  }
}

export function localDay(now: Date, timeZone = DEFAULT_WELLBEING_TIME_ZONE): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Date invalide.')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function shiftDay(day: string, delta: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(delta)) throw new Error('Date invalide.')
  const date = new Date(`${day}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Date invalide.')
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
