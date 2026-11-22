import { describe, expect, it } from 'vitest'
import {
  catalogueWidgetItems, currentWidgetItem, isAffirmationWidgetLink,
  parseWidgetPayload, validWidgetItem, widgetOrdinal, WIDGET_MAX_BYTES,
  type WidgetPayload,
} from '../../src/lib/affirmation-widget'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const payload = (): WidgetPayload => ({
  schemaVersion: 1, cadence: 'daily', configuredAt: '2026-11-11T07:00:00.000Z',
  items: [1, 2, 3].map(n => ({ id: id(n), text: `Affirmation ${n}.` })),
})
const raw = (change: Record<string, unknown> = {}) => JSON.stringify({ ...payload(), ...change })
const ordinal = (date: string, cadence: 'daily' | 'moments' = 'daily', zone = 'UTC') => widgetOrdinal(new Date(date), cadence, zone)

describe('widget calendar and rotation', () => {
  it('uses the local day and an explicit positive modulo before the epoch', () => {
    expect(ordinal('1970-01-01T00:00:00Z')).toBe(0)
    expect(ordinal('1969-12-31T23:59:59Z')).toBe(-1)
    expect(currentWidgetItem(payload(), new Date('1969-12-31T23:59:59Z'), 'UTC').id).toBe(id(3))
    expect(currentWidgetItem(payload(), new Date('1970-01-04T20:00:00Z'), 'UTC').id).toBe(id(1))
  })

  it('keeps yesterday evening before 07:00 and changes only at 07:00, 13:00 and 20:00', () => {
    const moments: [string, number][] = [
      ['1970-01-01T00:00:00Z', -1], ['1970-01-01T06:59:59Z', -1],
      ['1970-01-01T07:00:00Z', 0], ['1970-01-01T12:59:59Z', 0],
      ['1970-01-01T13:00:00Z', 1], ['1970-01-01T19:59:59Z', 1],
      ['1970-01-01T20:00:00Z', 2], ['1970-01-02T06:59:59Z', 2],
      ['1970-01-02T07:00:00Z', 3],
    ]
    for (const [date, expected] of moments) expect(ordinal(date, 'moments'), date).toBe(expected)
  })

  it('rotates without adjacent repetition when there is more than one selected phrase', () => {
    const selected = { ...payload(), cadence: 'moments' as const }
    expect(['07', '13', '20'].map(hour => currentWidgetItem(selected, new Date(`1970-01-01T${hour}:00:00Z`), 'UTC').id))
      .toEqual([id(1), id(2), id(3)])
    expect(currentWidgetItem(selected, new Date('1970-01-02T07:00:00Z'), 'UTC').id).toBe(id(1))
    const single = { ...selected, items: selected.items.slice(0, 1) }
    expect(currentWidgetItem(single, new Date('1969-12-31T06:00:00Z'), 'UTC')).toEqual(single.items[0])
  })

  it('changes day after 23 or 25 real hours at the Europe/Paris DST boundaries', () => {
    expect(ordinal('2026-03-29T22:00:00Z', 'daily', 'Europe/Paris') - ordinal('2026-03-28T23:00:00Z', 'daily', 'Europe/Paris')).toBe(1)
    expect(ordinal('2026-10-25T23:00:00Z', 'daily', 'Europe/Paris') - ordinal('2026-10-24T22:00:00Z', 'daily', 'Europe/Paris')).toBe(1)
    expect(ordinal('2026-03-29T01:00:00Z', 'moments', 'Europe/Paris')).toBe(ordinal('2026-03-29T00:59:59Z', 'moments', 'Europe/Paris'))
    expect(ordinal('2026-10-25T01:00:00Z', 'moments', 'Europe/Paris')).toBe(ordinal('2026-10-25T00:59:59Z', 'moments', 'Europe/Paris'))
    expect(ordinal('2026-03-29T05:00:00Z', 'moments', 'Europe/Paris')).toBe(ordinal('2026-03-29T04:59:59Z', 'moments', 'Europe/Paris') + 1)
  })

  it('uses the device destination day after travel, including the Samoa skipped day', () => {
    expect(ordinal('2026-11-11T02:00:00Z', 'daily', 'Europe/Paris') - ordinal('2026-11-11T02:00:00Z', 'daily', 'America/New_York')).toBe(1)
    expect(ordinal('2011-12-30T10:00:00Z', 'daily', 'Pacific/Apia') - ordinal('2011-12-30T09:59:59Z', 'daily', 'Pacific/Apia')).toBe(2)
    expect(() => widgetOrdinal(new Date('invalid'), 'daily', 'UTC')).toThrow('Date invalide')
    expect(() => ordinal('2026-11-11T02:00:00Z', 'daily', 'not/a-zone')).toThrow('Fuseau horaire invalide')
  })
})

describe('public catalogue selection', () => {
  it('never includes a custom/community source and preserves no extra database field', () => {
    const rows = [
      { id: id(3), source: 'user', text_fr: 'Ma phrase privée.' },
      { id: id(4), source: 'community', text_fr: 'Phrase communautaire.' },
      { id: id(2), source: 'purama', text_fr: 'Je prends le temps.', user_id: 'secret' },
      { id: id(1), source: 'purama', text_fr: '  Je reviens à moi.  ' },
      { id: 'custom-123', source: 'purama', text_fr: 'Une phrase.' },
    ]
    expect(catalogueWidgetItems(rows, 'fr')).toEqual([
      { id: id(1), text: 'Je reviens à moi.' }, { id: id(2), text: 'Je prends le temps.' },
    ])
  })

  it('deduplicates IDs case-insensitively and equivalent text after Unicode normalization', () => {
    const duplicate = 'ABCDEF12-ABCD-4000-8000-000000000001'
    const rows = [
      { id: duplicate, source: 'purama', text_fr: 'Élan.' },
      { id: duplicate.toLowerCase(), source: 'purama', text_fr: 'Autre texte.' },
      { id: id(2), source: 'purama', text_fr: 'E\u0301LAN.' },
    ]
    expect(catalogueWidgetItems(rows, 'fr')).toEqual([{ id: duplicate.toLowerCase(), text: 'Élan.' }])
  })

  it('does not silently substitute French for a missing English translation', () => {
    expect(catalogueWidgetItems([{ id: id(1), source: 'purama', text_fr: 'Bonjour.', text_en: null }], 'en')).toEqual([])
    expect(catalogueWidgetItems([{ id: id(1), source: 'purama', text_fr: 'Bonjour.', text_en: 'Hello.' }], 'en'))
      .toEqual([{ id: id(1), text: 'Hello.' }])
    expect(catalogueWidgetItems(null, 'fr')).toEqual([])
  })

  it('caps the snapshot at 30 short valid items without truncating words', () => {
    const rows = Array.from({ length: 40 }, (_, n) => ({ id: id(n + 1), source: 'purama', text_fr: `Phrase ${n}.` }))
    rows.unshift({ id: id(100), source: 'purama', text_fr: 'a'.repeat(101) })
    expect(catalogueWidgetItems(rows, 'fr')).toHaveLength(30)
    expect(catalogueWidgetItems(rows, 'fr').some(item => item.id === id(100))).toBe(false)
  })
})

describe('native snapshot validation', () => {
  it('round-trips the strict v1 DTO and allows 100 Unicode code points rather than 100 UTF-16 units', () => {
    expect(parseWidgetPayload(raw())).toEqual(payload())
    expect(validWidgetItem({ id: id(1), text: '🌿'.repeat(100) })).toBe(true)
    expect(validWidgetItem({ id: id(1), text: '🌿'.repeat(101) })).toBe(false)
    expect(validWidgetItem({ id: id(1), text: 'L’amour, c’est aussi s’écouter.' })).toBe(true)
  })

  it.each([
    { schemaVersion: 2 }, { cadence: 'hourly' }, { cadence: ['daily'] },
    { cadence: { value: 'daily' } }, { items: [] }, { items: null },
    { items: [{ id: 'custom-1', text: 'Texte.' }] },
    { items: [{ id: id(1), text: 'Texte.', user_id: 'someone' }] },
    { items: [{ id: id(1), text: 'Texte.' }, { id: id(1), text: 'Autre texte.' }] },
    { token: 'forbidden' }, { configuredAt: '2026-02-30T07:00:00Z' },
    { configuredAt: '2026-11-11T24:00:00Z' }, { configuredAt: '2026-11-11T07:00:00+00:00' },
    { configuredAt: 'invalid' },
  ])('rejects malformed or overbroad snapshots: %j', value => {
    expect(() => parseWidgetPayload(raw(value))).toThrow()
  })

  it('rejects malformed JSON, excess items and the UTF-8 byte ceiling', () => {
    expect(() => parseWidgetPayload('{')).toThrow('Sélection illisible')
    expect(() => parseWidgetPayload('null')).toThrow('Sélection invalide')
    expect(() => parseWidgetPayload(raw({ items: Array.from({ length: 31 }, (_, n) => ({ id: id(n), text: `Phrase ${n}.` })) }))).toThrow()
    expect(() => parseWidgetPayload(raw({ unused: 'é'.repeat(WIDGET_MAX_BYTES / 2) }))).toThrow('Sélection trop volumineuse')
  })

  it('rejects equivalent phrase text across different public IDs and categories', () => {
    expect(() => parseWidgetPayload(raw({ items: [
      { id: id(1), text: 'Élan.' }, { id: id(2), text: 'Ｅ\u0301ＬＡＮ.' },
    ] }))).toThrow()
  })

  it.each(['', ' texte', 'texte ', 'a\nb', 'a\tb', 'a\u0085b', 'a\u2028b', 'a\u202eb', 'a\u2066b', 'a\ud800b', 'a\udfffb'])('rejects invisible controls and ambiguous outer spaces (%j)', text => {
    expect(validWidgetItem({ id: id(1), text })).toBe(false)
  })
})

describe('widget URL allowlist', () => {
  it('accepts only the fixed custom-scheme authority', () => {
    expect(isAffirmationWidgetLink('mukti://affirmations')).toBe(true)
    for (const url of [
      'https://mukti.purama.dev/dashboard/subconscient/ecran-verrouille', 'javascript:alert(1)',
      'mukti://evil', 'mukti://affirmations.evil.test', 'mukti://affirmations@evil.test',
      'mukti://attacker@affirmations', 'mukti://affirmations:443', 'mukti://affirmations/',
      'mukti://affirmations/path', 'mukti://affirmations?next=https://evil.test',
      'mukti://affirmations#route', 'mukti:affirmations', '%6dukti://affirmations', 'not a URL',
    ]) expect(isAffirmationWidgetLink(url), url).toBe(false)
  })
})
