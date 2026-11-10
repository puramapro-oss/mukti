// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeAudioJournal, createTextJournal, deleteEntry, getJournalContext, listEntries,
  type JournalContext,
} from '../../src/lib/mental-journal'
import {
  AudioJournalSchema, JOURNAL_CONSENT_VERSION, JournalError, MentalJournalEntrySchema,
  type AudioJournalInput, type TextJournalInput,
} from '../../src/lib/mental-journal-contract'
import { readJournalBody } from '../../src/lib/mental-journal-http'
import { POST as retiredCron } from '../../src/app/api/cron/mental-journal-relapse-scan/route'
import { POST as saveTextRoute, DELETE as deleteRoute, GET as listRoute } from '../../src/app/api/mental-journal/entries/route'
import { POST as audioRoute } from '../../src/app/api/mental-journal/analyze/route'

const dependencies = vi.hoisted(() => ({ server: vi.fn(), service: vi.fn(), rateLimit: vi.fn() }))
vi.mock('../../src/lib/supabase-server', () => ({ createServerSupabaseClient: dependencies.server }))
vi.mock('../../src/lib/supabase', () => ({ createServiceClient: dependencies.service }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: dependencies.rateLimit }))

const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const ENTRY = '10000000-0000-4000-8000-000000000001'
const OTHER_ENTRY = '10000000-0000-4000-8000-000000000002'
type Row = Record<string, unknown>
type DatabaseError = { code?: string; message: string }

function database() {
  const rows = new Map<string, Row>()
  const mutations: Array<{ action: string; filters: Array<[string, unknown]>; value: Row | null }> = []
  const state = { authenticated: true, readError: false, insertError: false, updateError: false, deleteError: false }
  function from(table: string) {
    let action = 'read'
    let values: Row | null = null
    const filters: Array<[string, unknown]> = []
    const result = async (multiple: boolean, limit = 30): Promise<{ data: unknown; error: DatabaseError | null }> => {
      if (table === 'profiles') return { data: { id: OWNER }, error: null }
      if (action === 'read' && state.readError) return { data: null, error: { message: 'synthetic storage error' } }
      if (action !== 'read') mutations.push({ action, filters: [...filters], value: values })
      if (action === 'insert') {
        if (state.insertError) return { data: null, error: { message: 'synthetic storage error' } }
        const id = String(values?.id)
        if (rows.has(id)) return { data: null, error: { code: '23505', message: 'duplicate' } }
        const row = { ...values, created_at: '2026-11-10T12:00:00.000Z' }
        rows.set(id, row)
        return { data: row, error: null }
      }
      const found = [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, limit)
      if (action === 'update') {
        if (state.updateError) return { data: null, error: { message: 'synthetic storage error' } }
        for (const row of found) Object.assign(row, values)
      }
      if (action === 'delete') {
        if (state.deleteError) return { data: null, error: { message: 'synthetic storage error' } }
        for (const row of found) rows.delete(String(row.id))
      }
      return { data: multiple ? found : found[0] ?? null, error: null }
    }
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query }),
      order: vi.fn(() => query),
      insert: vi.fn((value: Row) => { action = 'insert'; values = value; return query }),
      update: vi.fn((value: Row) => { action = 'update'; values = value; return query }),
      delete: vi.fn(() => { action = 'delete'; return query }),
      maybeSingle: () => result(false), single: () => result(false), limit: (limit: number) => result(true, limit),
    }
    return query
  }
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.authenticated ? { id: 'auth-owner' } : null }, error: null })) },
    schema: vi.fn(() => ({ from })),
  }
  const context: JournalContext = { client: client as unknown as JournalContext['client'], profileId: OWNER, userId: 'auth-owner' }
  return { rows, mutations, state, client, context }
}

const textInput = (changes: Partial<TextJournalInput> = {}): TextJournalInput => ({
  client_entry_id: ENTRY, text: 'Texte de journal synthétique pour le test.', lang_hint: 'fr', reflection_consent: null, ...changes,
})
function audioInput(changes: Partial<AudioJournalInput> = {}): AudioJournalInput {
  const buffer = Buffer.alloc(1024)
  buffer.set([0x1a, 0x45, 0xdf, 0xa3])
  return {
    client_entry_id: ENTRY, lang_hint: 'fr', reflection_consent: null,
    audio_base64: buffer.toString('base64'), audio_mime_type: 'audio/webm', declared_duration_sec: 12,
    transcription_consent: JOURNAL_CONSENT_VERSION, ...changes,
  }
}
function row(changes: Row = {}): Row {
  return {
    id: ENTRY, user_id: OWNER, transcript: 'Ancien écrit conservé.', transcript_lang: 'fr', audio_duration_sec: null,
    entry_source: 'legacy', reflection: null, reflection_status: 'not_requested', created_at: '2026-11-09T12:00:00.000Z', ...changes,
  }
}
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status }) }
function request(path: string, method: string, data?: unknown) {
  return new Request(`https://example.invalid${path}`, { method, headers: { 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
}
let db: ReturnType<typeof database>
beforeEach(() => {
  vi.clearAllMocks()
  db = database()
  dependencies.server.mockResolvedValue(db.client)
  dependencies.service.mockReturnValue(db.client)
  dependencies.rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key')
  vi.stubEnv('ANTHROPIC_API_KEY', 'synthetic-test-key')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('Journal storage, consent and optional reflection', () => {
  it('saves text without calling an AI or generating inferred values', async () => {
    const result = await createTextJournal(textInput(), { context: db.context })
    expect(fetch).not.toHaveBeenCalled()
    expect(result.entry.transcript).toBe(textInput().text)
    expect(result.entry.reflection_status).toBe('not_requested')
    expect(db.rows.get(ENTRY)?.reflection_consented_at).toBeNull()
    expect(db.rows.get(ENTRY)).not.toHaveProperty('relapse_risk')
    expect(db.rows.get(ENTRY)).not.toHaveProperty('mood_score')
    expect(result.entry).not.toHaveProperty('user_id')
  })
  it('rejects invalid consent versions before any write or provider call', async () => {
    const invalid = { ...textInput(), reflection_consent: 'outdated' } as unknown as TextJournalInput
    await expect(createTextJournal(invalid, { context: db.context })).rejects.toMatchObject({ status: 400 })
    expect(db.mutations).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('persists the writing before a separately consented AI call', async () => {
    const selection = { excerpts: ['Texte de journal synthétique pour le test.'], question_ids: ['remember'] }
    const reflection = { summary: 'Dans tes mots : « Texte de journal synthétique pour le test. »', questions: ['Que souhaites-tu retenir de ce moment ?'] }
    const provider = vi.fn(async () => {
      expect(db.rows.get(ENTRY)?.transcript).toBe(textInput().text)
      return response({ content: [{ type: 'text', text: JSON.stringify(selection) }] })
    })
    vi.stubGlobal('fetch', provider)
    const result = await createTextJournal(textInput({ reflection_consent: JOURNAL_CONSENT_VERSION }), { context: db.context })
    expect(provider).toHaveBeenCalledOnce()
    expect(result.entry.reflection).toEqual(reflection)
    expect(result.entry.reflection_status).toBe('available')
    expect(db.rows.get(ENTRY)?.reflection_consent_version).toBe(JOURNAL_CONSENT_VERSION)
    expect(db.mutations.at(-1)?.filters).toContainEqual(['user_id', OWNER])
  })
  it.each([
    { summary: 4, questions: [] },
    { summary: 'Texte', questions: ['Question ?'], relapse_risk: 0.9 },
    { summary: 'Texte', questions: 'not-an-array' },
    { excerpts: ['Une prédiction inventée hors du journal.'], question_ids: ['remember'] },
    { excerpts: ['Texte de journal synthétique pour le test.'], question_ids: ['unvalidated_clinical_advice'] },
  ])('keeps the writing when provider output violates the reflection contract: %j', async reflection => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ content: [{ type: 'text', text: JSON.stringify(reflection) }] })))
    const result = await createTextJournal(textInput({ reflection_consent: JOURNAL_CONSENT_VERSION }), { context: db.context })
    expect(result.entry.transcript).toBe(textInput().text)
    expect(result.entry.reflection).toBeNull()
    expect(result.entry.reflection_status).toBe('unavailable')
    expect(result.warning).toMatch(/enregistré/)
  })
  it('keeps the writing if the provider fails or its key is unavailable', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await createTextJournal(textInput({ reflection_consent: JOURNAL_CONSENT_VERSION }), { context: db.context })
    expect(fetch).not.toHaveBeenCalled()
    expect(result.entry.reflection_status).toBe('unavailable')
    expect(db.rows.has(ENTRY)).toBe(true)
  })
  it('does not call an AI when persistence failed', async () => {
    db.state.insertError = true
    await expect(createTextJournal(textInput({ reflection_consent: JOURNAL_CONSENT_VERSION }), { context: db.context })).rejects.toMatchObject({ status: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('reports a reflection update failure without losing the saved text', async () => {
    db.state.updateError = true
    vi.stubGlobal('fetch', vi.fn(async () => response({ content: [{ type: 'text', text: '{"excerpts":["Texte de journal synthétique pour le test."],"question_ids":["remember"]}' }] })))
    const result = await createTextJournal(textInput({ reflection_consent: JOURNAL_CONSENT_VERSION }), { context: db.context })
    expect(result.warning).toMatch(/n'a pas pu/)
    expect(db.rows.get(ENTRY)?.transcript).toBe(textInput().text)
    expect(result.entry.reflection).toBeNull()
  })
  it('deduplicates a retry with the same entry id without another external call', async () => {
    db.rows.set(ENTRY, row())
    const result = await createTextJournal(textInput(), { context: db.context })
    expect(result.entry.transcript).toBe('Ancien écrit conservé.')
    expect(db.mutations).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('returns legacy writings without their inferred fields and excludes another owner', async () => {
    db.rows.set(ENTRY, row({ relapse_risk: 0.99, mood_score: 3, mood_analysis: { unsafe: true }, insights_fr: ['legacy analysis'] }))
    db.rows.set(OTHER_ENTRY, row({ id: OTHER_ENTRY, user_id: OTHER, transcript: 'Another owner' }))
    const entries = await listEntries(30, db.context)
    expect(entries).toHaveLength(1)
    expect(entries[0].transcript).toBe('Ancien écrit conservé.')
    for (const key of ['relapse_risk', 'mood_score', 'mood_analysis', 'insights_fr', 'user_id']) expect(entries[0]).not.toHaveProperty(key)
  })
  it('reports database failure instead of claiming history is empty', async () => {
    db.state.readError = true
    await expect(listEntries(7, db.context)).rejects.toMatchObject({ status: 503 })
  })
  it('deletes only the authenticated owner entry', async () => {
    db.rows.set(ENTRY, row())
    db.rows.set(OTHER_ENTRY, row({ id: OTHER_ENTRY, user_id: OTHER }))
    await expect(deleteEntry(OTHER_ENTRY, db.context)).rejects.toMatchObject({ status: 404 })
    expect(db.rows.has(OTHER_ENTRY)).toBe(true)
    await deleteEntry(ENTRY, db.context)
    expect(db.rows.has(ENTRY)).toBe(false)
    expect(db.rows.has(OTHER_ENTRY)).toBe(true)
    expect(db.mutations.every(mutation => mutation.filters.some(([key, value]) => key === 'user_id' && value === OWNER))).toBe(true)
  })
  it('requires authentication before resolving a journal', async () => {
    db.state.authenticated = false
    await expect(getJournalContext()).rejects.toMatchObject({ status: 401 })
    expect(dependencies.service).not.toHaveBeenCalled()
  })
})

describe('Audio validation and transcription', () => {
  it('does not accept audio without the current transcription consent', async () => {
    const input = { ...audioInput(), transcription_consent: undefined }
    expect(AudioJournalSchema.safeParse(input).success).toBe(false)
    const result = await audioRoute(request('/api/mental-journal/analyze', 'POST', input))
    expect(result.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(db.mutations).toHaveLength(0)
  })
  it('rejects a mismatched audio container before sending it', async () => {
    await expect(analyzeAudioJournal(audioInput({ audio_mime_type: 'audio/mp4' }), { context: db.context })).rejects.toMatchObject({ status: 400 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('transcribes only the consented audio and makes no reflection call by default', async () => {
    const provider = vi.fn(async () => response({ text: 'Texte transcrit synthétique.', language: 'fr', duration: 11.9 }))
    vi.stubGlobal('fetch', provider)
    const result = await analyzeAudioJournal(audioInput(), { context: db.context })
    expect(provider).toHaveBeenCalledOnce()
    expect(result.entry.transcript).toBe('Texte transcrit synthétique.')
    expect(result.entry.audio_duration_sec).toBe(12)
    expect(result.entry.reflection_status).toBe('not_requested')
    expect(db.rows.get(ENTRY)?.transcription_consent_version).toBe(JOURNAL_CONSENT_VERSION)
    expect(db.rows.get(ENTRY)).not.toHaveProperty('audio_base64')
  })
  it('handles the Safari MP4 container with the correct file extension', async () => {
    const buffer = Buffer.alloc(1024)
    buffer.write('ftyp', 4, 'ascii')
    const provider = vi.fn(async (_url: unknown, options: RequestInit) => {
      const file = (options.body as FormData).get('file') as File
      expect(file.name).toBe('journal.mp4')
      expect(file.type).toBe('audio/mp4')
      return response({ text: 'Note audio synthétique.', duration: 5 })
    })
    vi.stubGlobal('fetch', provider)
    await analyzeAudioJournal(audioInput({ audio_base64: buffer.toString('base64'), audio_mime_type: 'audio/mp4' }), { context: db.context })
    expect(provider).toHaveBeenCalledOnce()
  })
  it.each([{ duration: 190, text: 'Long audio' }, { text: 'Missing duration' }, { duration: 12, text: '' }])('rejects an invalid provider transcription: %j', async value => {
    vi.stubGlobal('fetch', vi.fn(async () => response(value)))
    await expect(analyzeAudioJournal(audioInput(), { context: db.context })).rejects.toBeInstanceOf(JournalError)
    expect(db.mutations).toHaveLength(0)
  })
  it('does not contact a provider for an already cancelled operation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(analyzeAudioJournal(audioInput(), { context: db.context, signal: controller.signal })).rejects.toMatchObject({ status: 408 })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Journal routes, request limits and retired scheduler', () => {
  it('returns 401 before inspecting malformed input for every journal mutation', async () => {
    db.state.authenticated = false
    for (const handler of [saveTextRoute, deleteRoute, audioRoute]) {
      const result = await handler(request('/api/mental-journal/entries', 'POST', null))
      expect(result.status).toBe(401)
    }
    expect(dependencies.service).not.toHaveBeenCalled()
  })
  it('serves a private no-store successful text response', async () => {
    const result = await saveTextRoute(request('/api/mental-journal/entries', 'POST', textInput()))
    expect(result.status).toBe(201)
    expect(result.headers.get('cache-control')).toContain('no-store')
    const payload = await result.json()
    expect(MentalJournalEntrySchema.safeParse(payload.entry).success).toBe(true)
  })
  it('reports invalid limits and storage errors accurately', async () => {
    expect((await listRoute(request('/api/mental-journal/entries?limit=NaN', 'GET'))).status).toBe(400)
    db.state.readError = true
    expect((await listRoute(request('/api/mental-journal/entries', 'GET'))).status).toBe(503)
  })
  it('rejects an oversized actual body without a Content-Length header', async () => {
    const req = request('/api/mental-journal/entries', 'POST', { text: 'x'.repeat(100) })
    await expect(readJournalBody(req, 32)).rejects.toMatchObject({ status: 413 })
  })
  it('rejects malformed JSON and wrong content types', async () => {
    await expect(readJournalBody(new Request('https://example.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 32)).rejects.toMatchObject({ status: 400 })
    await expect(readJournalBody(new Request('https://example.invalid', { method: 'POST', body: '{}' }), 32)).rejects.toMatchObject({ status: 415 })
  })
  it('enforces per-user rate limiting before storage writes or provider calls', async () => {
    dependencies.rateLimit.mockReturnValue({ ok: false, retryAfterSec: 20 })
    const result = await saveTextRoute(request('/api/mental-journal/entries', 'POST', textInput()))
    expect(result.status).toBe(429)
    expect(result.headers.get('retry-after')).toBe('20')
    expect(db.mutations).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('never trusts a caller-supplied cron header', async () => {
    vi.stubEnv('CRON_SECRET', 'synthetic-cron-secret')
    const result = await retiredCron(new Request('https://example.invalid/cron', { headers: { 'x-vercel-cron': '1' } }))
    expect(result.status).toBe(401)
    expect(dependencies.service).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps the retired cron inert even with valid authentication', async () => {
    vi.stubEnv('CRON_SECRET', 'synthetic-cron-secret')
    const result = await retiredCron(new Request('https://example.invalid/cron', { headers: { authorization: 'Bearer synthetic-cron-secret' } }))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ ok: true, enabled: false, alerted: 0 })
    expect(dependencies.service).not.toHaveBeenCalled()
    expect(dependencies.server).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
