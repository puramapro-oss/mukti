import { localDay, normalizeTimeZone } from './wellbeing-date'

export const AFFIRMATION_WIDGET_PATH = '/dashboard/subconscient/ecran-verrouille'
export const WIDGET_MAX_ITEMS = 30
export const WIDGET_MAX_TEXT = 100
export const WIDGET_MAX_BYTES = 20 * 1024
export type WidgetCadence = 'daily' | 'moments'
export interface WidgetItem { id: string; text: string }
export interface WidgetPayload {
  schemaVersion: 1
  cadence: WidgetCadence
  items: WidgetItem[]
  configuredAt: string
}

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const hiddenControls = /[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069\ud800-\udfff]/u
const isoUtc = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function widgetTextKey(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

export function validWidgetItem(value: unknown): value is WidgetItem {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'id,text') return false
  return typeof value.id === 'string' && uuid.test(value.id)
    && typeof value.text === 'string' && value.text === value.text.trim()
    && Array.from(value.text).length > 0 && Array.from(value.text).length <= WIDGET_MAX_TEXT
    && !hiddenControls.test(value.text) && /[^\s\p{Cf}]/u.test(value.text)
}

/** Only already-public catalogue rows enter the device snapshot. No user table is read. */
export function catalogueWidgetItems(rows: unknown, locale: 'fr' | 'en'): WidgetItem[] {
  if (!Array.isArray(rows)) return []
  const ids = new Set<string>()
  const texts = new Set<string>()
  const result: WidgetItem[] = []
  for (const row of rows) {
    if (!record(row) || row.source !== 'purama') continue
    const value = locale === 'en' ? row.text_en : row.text_fr
    const item = { id: row.id, text: typeof value === 'string' ? value.trim() : value }
    if (!validWidgetItem(item)) continue
    const id = item.id.toLowerCase()
    const text = widgetTextKey(item.text)
    if (ids.has(id) || texts.has(text)) continue
    ids.add(id); texts.add(text)
    result.push({ id, text: item.text })
  }
  return result.sort((a, b) => a.id.localeCompare(b.id)).slice(0, WIDGET_MAX_ITEMS)
}

export function parseWidgetPayload(raw: string): WidgetPayload {
  if (new TextEncoder().encode(raw).length > WIDGET_MAX_BYTES) throw new Error('Sélection trop volumineuse.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new Error('Sélection illisible. Configure à nouveau le widget.') }
  if (!record(input) || Object.keys(input).sort().join(',') !== 'cadence,configuredAt,items,schemaVersion'
    || input.schemaVersion !== 1 || typeof input.cadence !== 'string' || !['daily', 'moments'].includes(input.cadence)
    || typeof input.configuredAt !== 'string' || !isoUtc.test(input.configuredAt)
    || !Number.isFinite(Date.parse(input.configuredAt))
    || new Date(input.configuredAt).toISOString().slice(0, 19) !== input.configuredAt.slice(0, 19)
    || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > WIDGET_MAX_ITEMS
    || !input.items.every(validWidgetItem)) throw new Error('Sélection invalide. Choisis de 1 à 30 affirmations courtes.')
  if (new Set(input.items.map(item => item.id.toLowerCase())).size !== input.items.length) {
    throw new Error('Une affirmation ne peut apparaître deux fois dans la sélection.')
  }
  if (new Set(input.items.map(item => widgetTextKey(item.text))).size !== input.items.length) {
    throw new Error('Deux affirmations de la sélection ont le même texte.')
  }
  return input as unknown as WidgetPayload
}

/** Calendar components, not elapsed 24-hour durations: DST and travel remain coherent. */
export function widgetOrdinal(now: Date, cadence: WidgetCadence, zone = Intl.DateTimeFormat().resolvedOptions().timeZone): number {
  const timeZone = normalizeTimeZone(zone)
  const day = Math.floor(Date.parse(`${localDay(now, timeZone)}T00:00:00Z`) / 86_400_000)
  if (cadence === 'daily') return day
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now))
  return hour < 7 ? (day - 1) * 3 + 2 : day * 3 + (hour < 13 ? 0 : hour < 20 ? 1 : 2)
}

export function currentWidgetItem(payload: WidgetPayload, now = new Date(), timeZone?: string): WidgetItem {
  const ordinal = widgetOrdinal(now, payload.cadence, timeZone)
  return payload.items[((ordinal % payload.items.length) + payload.items.length) % payload.items.length]!
}

export function isAffirmationWidgetLink(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'mukti:' && url.hostname === 'affirmations' && !url.port
      && !url.username && !url.password && !url.pathname && !url.search && !url.hash
  } catch { return false }
}
