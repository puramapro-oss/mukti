// Frontières réelles de programs.ts ; Anthropic et Supabase sont des doublures explicites.
// Aucun appel réseau, génération réelle, donnée patient ou validation clinique.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import {
  parseProgramStructure, ProgramStructureError,
} from '../../src/lib/programs-schema'
import {
  generateProgramForAddiction, getLatestProgram, storeProgram, canRegenerateProgram, ProgramReadError,
} from '../../src/lib/programs'
import { POST } from '../../src/app/api/program/generate/route'
import AddictionDetailPage from '../../src/app/(dashboard)/dashboard/liberation/[addictionId]/page'
import type { ProgramStructure } from '../../src/lib/programs-types'
import type { Addiction } from '../../src/lib/addictions'

const services = vi.hoisted(() => ({
  generate: vi.fn(), stream: vi.fn(), server: vi.fn(), admin: vi.fn(),
  rateLimit: vi.fn(), streak: vi.fn(), programView: vi.fn(),
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: services.generate, stream: services.stream }
  },
}))
vi.mock('../../src/lib/supabase-server', () => ({
  createServerSupabaseClient: services.server,
}))
vi.mock('../../src/lib/supabase', () => ({
  createServiceClient: services.admin,
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: services.rateLimit, getClientIp: () => '198.51.100.2' }))
vi.mock('@/lib/streaks', () => ({ getStreakState: services.streak }))
vi.mock('next/navigation', () => ({
  redirect: () => { throw new Error('Redirection de test') },
  notFound: () => { throw new Error('Page absente de test') },
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children),
}))
// La vraie page conserve ses décisions ; ses composants annexes sont des doublures explicites.
vi.mock('@/components/liberation/StreakCounter', () => ({ default: () => null }))
vi.mock('@/components/liberation/MilestonePanel', () => ({ default: () => null }))
vi.mock('@/components/liberation/CheckinButton', () => ({ default: () => null }))
vi.mock('@/components/liberation/RelapseButton', () => ({ default: () => null }))
vi.mock('@/components/liberation/ProgramView', () => ({ default: services.programView }))

const addiction: Addiction = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  type: 'tabac', severity: 2, frequency_daily: null, started_ago_months: null,
  triggers: [], goal: 'reduce', status: 'active', custom_label: null,
  declared_at: '2026-11-12T00:00:00Z', liberated_at: null,
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z',
}
function fixture(): ProgramStructure {
  return {
    addiction_type: 'tabac', severity: 2, intention: 'Faire une pause',
    phases: ['1-7', '8-30', '31-90'].map(days_range => ({
      name: 'Étape', days_range, intent: 'Observer son ressenti',
      daily_rituals: [{
        moment: 'soir', title: 'Pause', duration_sec: 30, description: 'Texte de test',
      }],
      recommended_modes: [], affirmations: ['Je peux choisir une pause.'],
    })),
    micro_meditations: Array.from({ length: 4 }, () => ({
      trigger: 'stress', title: 'Pause', script: 'Texte non évalué cliniquement.', duration_sec: 20,
    })),
    affirmations: Array.from({ length: 10 }, () => 'Je peux choisir une pause.'),
    recommended_modes: [],
    plants_info: [{ name: 'Exemple', latin_name: null, benefits: 'Non évalués', disclaimer: 'Test uniquement' }],
    anti_pulsion_actions: [{ situation: 'Pause', action: 'Observer', duration_sec: 10 }],
    breathing_protocols: [{ name: 'Exemple', pattern: 'Libre', description: 'Test uniquement' }],
    hypnose_scripts: [{ title: 'Exemple', duration_min: 2, script: 'Texte non évalué cliniquement.' }],
    risk_triggers: [], success_markers: [], emergency_message: 'Ressource de test',
  }
}
function response(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'produce_program', input }],
    usage: { input_tokens: 20, output_tokens: 40 },
  }
}
function row(opus_response: unknown) {
  return {
    id: '00000000-0000-4000-8000-000000000003', addiction_id: addiction.id,
    user_id: addiction.user_id, version: 2, model_used: 'test-model',
    generated_at: '2026-11-12T00:00:00Z', is_current: true, opus_response,
  }
}
function queryDouble() {
  const query = {
    select: vi.fn(), eq: vi.fn(), update: vi.fn(), insert: vi.fn(),
    order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(),
  }
  for (const method of ['select', 'eq', 'update', 'insert', 'order', 'limit'] as const) {
    query[method].mockReturnValue(query)
  }
  return query
}
function storageParams(program: ProgramStructure) {
  return {
    addictionId: addiction.id, userId: addiction.user_id, program,
    inputTokens: 20, outputTokens: 40, model: 'test-model',
  }
}

beforeEach(() => {
  for (const mock of Object.values(services)) mock.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-never-sent')
  vi.stubEnv('ANTHROPIC_MODEL_PRO', 'test-model')
  services.rateLimit.mockReturnValue({ ok: true })
  services.streak.mockResolvedValue({ streak: null, next_milestone: null, next_milestone_days_away: null })
  services.programView.mockImplementation(({ currentProgram }: { currentProgram: ProgramStructure | null }) =>
    createElement('section', { 'data-testid': 'program-view-double' }, currentProgram
      ? currentProgram.intention
      : createElement('button', null, 'Générer le programme de test')))
})
afterEach(() => vi.unstubAllEnvs())

describe('Contrat de structure du programme', () => {
  it('copie un programme conforme sans lui attribuer de qualification clinique', () => {
    const original = fixture()
    const parsed = parseProgramStructure({ ...original, clinically_validated: true })
    expect(parsed).toEqual(original)
    expect(parsed).not.toBe(original)
    expect(parsed.hypnose_scripts[0]).not.toBe(original.hypnose_scripts[0])
    expect(parsed).not.toHaveProperty('clinically_validated')
  })

  it('normalise le nom latin facultatif historique et accepte zéro plante', () => {
    const original = fixture()
    const withLegacyPlant = {
      ...original, plants_info: [{ name: 'Exemple', benefits: 'Non évalués', disclaimer: 'Test' }],
    }
    expect(parseProgramStructure(withLegacyPlant).plants_info[0].latin_name).toBeNull()
    const { plants_info: ignored, ...withoutPlants } = original
    void ignored
    expect(parseProgramStructure(withoutPlants).plants_info).toEqual([])
    expect(parseProgramStructure({ ...original, plants_info: [] }).plants_info).toEqual([])
  })

  it.each([null, [], {}, { hypnose_scripts: 'pas un tableau' }])('refuse une structure incorrecte : %j', value => {
    expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
  })

  it.each([
    ['phases manquantes', { ...fixture(), phases: undefined }],
    ['type inconnu', { ...fixture(), addiction_type: 'type-inconnu' }],
    ['sévérité hors bornes', { ...fixture(), severity: 6 }],
    ['sévérité fractionnaire', { ...fixture(), severity: 1.5 }],
    ['deux phases seulement', { ...fixture(), phases: fixture().phases.slice(0, 2) }],
    ['micro-méditations incomplètes', { ...fixture(), micro_meditations: [] }],
    ['affirmations non textuelles', { ...fixture(), affirmations: Array(10).fill(123) }],
    ['message absent', { ...fixture(), emergency_message: undefined }],
  ])('refuse %s', (_label, value) => {
    expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
  })

  it.each([0, 31, Number.NaN, Number.POSITIVE_INFINITY])('refuse une durée d’hypnose invalide : %s', duration => {
    const value = fixture()
    value.hypnose_scripts[0].duration_min = duration
    expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
  })

  it('refuse les durées entières hors bornes dans les autres blocs', () => {
    for (const duration of [9, 60.5, 61]) {
      const value = fixture()
      value.micro_meditations[0].duration_sec = duration
      expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
    }
    const value = fixture()
    value.phases[0].daily_rituals[0].duration_sec = 1801
    expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
    value.phases[0].daily_rituals[0].duration_sec = 30
    value.anti_pulsion_actions[0].duration_sec = 4
    expect(() => parseProgramStructure(value)).toThrow(ProgramStructureError)
  })

  it('ne recopie pas le contenu privé dans l’erreur de validation', () => {
    try {
      parseProgramStructure({ intention: 'SECRET-PRIVE-DE-TEST', hypnose_scripts: 1 })
      throw new Error('Validation attendue')
    } catch (error) {
      expect(error).toBeInstanceOf(ProgramStructureError)
      expect(String(error)).not.toContain('SECRET-PRIVE-DE-TEST')
      expect(error).toMatchObject({ code: 'INVALID_PROGRAM_STRUCTURE' })
      expect(error).not.toHaveProperty('issues')
    }
  })
})

describe('Frontières effectives de programs.ts', () => {
  it('valide la réponse outil avant le retour de génération', async () => {
    const original = fixture()
    services.generate.mockResolvedValue(response(original))
    const result = await generateProgramForAddiction(addiction)
    expect(result).toMatchObject({ program: original, input_tokens: 20, output_tokens: 40, model: 'test-model' })
    expect(result.program).not.toBe(original)
    expect(services.generate).toHaveBeenCalledOnce()
    expect(services.admin).not.toHaveBeenCalled()
  })

  it('refuse une sortie outil partielle au lieu de la convertir par assertion', async () => {
    services.generate.mockResolvedValue(response({ intention: 'SECRET-PRIVE-DE-TEST' }))
    await expect(generateProgramForAddiction(addiction)).rejects.toThrow(ProgramStructureError)
  })

  it('refuse une réponse sans l’outil attendu', async () => {
    services.generate.mockResolvedValue({ content: [{ type: 'text', text: 'SECRET-PRIVE-DE-TEST' }], usage: {} })
    await expect(generateProgramForAddiction(addiction)).rejects.toThrow('Opus n\'a pas retourné la structure attendue.')
  })

  it('refuse un programme invalide avant toute création de client de stockage', async () => {
    const malformed = { intention: 'SECRET-PRIVE-DE-TEST' } as ProgramStructure
    await expect(storeProgram(storageParams(malformed))).rejects.toThrow(ProgramStructureError)
    expect(services.admin).not.toHaveBeenCalled()
    expect(services.server).not.toHaveBeenCalled()
  })

  it('persiste une copie normalisée, sans modification concurrente de l’objet appelant', async () => {
    const value = fixture()
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: { version: 1 }, error: null })
    query.single.mockResolvedValue({ data: row(fixture()), error: null })
    services.admin.mockReturnValue({ from: vi.fn(() => query) })
    const pending = storeProgram(storageParams(value))
    value.plants_info[0].name = 'MUTATION-APRES-APPEL'
    const stored = await pending
    expect(stored.version).toBe(2)
    expect(query.insert).toHaveBeenCalledOnce()
    const inserted = query.insert.mock.calls[0][0]
    expect(inserted.opus_response.plants_info[0].name).toBe('Exemple')
    expect(inserted.plants_info).toEqual(inserted.opus_response.plants_info)
  })

  it('ne transmet pas un message privé du service dans une erreur de persistance', async () => {
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: { version: 1 }, error: null })
    query.single.mockResolvedValue({ data: null, error: { message: 'SECRET-BASE-DE-TEST' } })
    services.admin.mockReturnValue({ from: vi.fn(() => query) })
    await expect(storeProgram(storageParams(fixture()))).rejects.toThrow('Persistence programme échouée.')
  })

  it('valide un programme lu et normalise ses plantes historiques', async () => {
    const legacy = {
      ...fixture(), plants_info: [{ name: 'Exemple', benefits: 'Non évalués', disclaimer: 'Test' }],
    }
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: row(legacy), error: null })
    services.server.mockResolvedValue({ from: vi.fn(() => query) })
    const current = await getLatestProgram(addiction.id)
    expect(current?.plants_info[0].latin_name).toBeNull()
    expect(current?.id).toBe(row(legacy).id)
    expect(services.admin).not.toHaveBeenCalled()
  })

  it('refuse un JSON stocké invalide avant sa projection vers l’interface', async () => {
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: row({ intention: 'SECRET-PRIVE-DE-TEST' }), error: null })
    services.server.mockResolvedValue({ from: vi.fn(() => query) })
    await expect(getLatestProgram(addiction.id)).rejects.toThrow(ProgramStructureError)
  })

  it('préserve le résultat null quand aucun programme n’est présent', async () => {
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    services.server.mockResolvedValue({ from: vi.fn(() => query) })
    await expect(getLatestProgram(addiction.id)).resolves.toBeNull()
  })
})

function readsFixture(options: {
  current?: unknown
  generatedAt?: unknown
  currentError?: boolean
  metadataError?: boolean
  ownerError?: boolean
} = {}) {
  const current = queryDouble()
  current.maybeSingle.mockResolvedValue({
    data: options.current === undefined ? row(fixture()) : options.current,
    error: options.currentError ? { message: 'SECRET-LECTURE' } : null,
  })
  const metadata = queryDouble()
  metadata.maybeSingle.mockResolvedValue({
    data: options.generatedAt === null ? null : { generated_at: options.generatedAt ?? '2026-10-01T00:00:00Z' },
    error: options.metadataError ? { message: 'SECRET-DELAI' } : null,
  })
  const owner = queryDouble()
  owner.maybeSingle.mockResolvedValue({
    data: options.ownerError ? null : addiction,
    error: options.ownerError ? { message: 'SECRET-PROPRIETAIRE' } : null,
  })
  const programSelect = vi.fn((columns: string) => columns === '*' ? current : metadata)
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }) },
    from: vi.fn((table: string) => table === 'programs'
      ? { select: programSelect }
      : table === 'addictions' ? owner : {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      }),
  }
  services.server.mockResolvedValue(client)
  return { client, current, metadata, owner, programSelect }
}
function request() {
  return new Request('https://example.test/api/program/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addiction_id: addiction.id }),
  })
}
function streamFixture(input: unknown) {
  services.stream.mockReturnValue({
    [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }),
    finalMessage: vi.fn().mockResolvedValue(response(input)),
  })
}

describe('Lecture et délai de régénération indépendants du contenu', () => {
  it('conserve le délai d’un ancien programme malformé à partir de ses métadonnées', async () => {
    const reads = readsFixture({ current: row({ intention: 'SECRET-CONTENU-INVALIDE' }), generatedAt: '2026-11-11T12:00:00Z' })
    await expect(getLatestProgram(addiction.id)).rejects.toThrow(ProgramStructureError)
    await expect(canRegenerateProgram(addiction.id)).resolves.toEqual({
      allowed: false,
      reason: expect.any(String),
      next_available_at: '2026-12-11T12:00:00.000Z',
    })
    expect(reads.programSelect).toHaveBeenCalledWith('generated_at')
    expect(reads.metadata.eq).toHaveBeenCalledWith('addiction_id', addiction.id)
    expect(services.admin).not.toHaveBeenCalled()
  })

  it('autorise la régénération à l’échéance même si le contenu historique est invalide', async () => {
    readsFixture({ current: row({}), generatedAt: '2026-10-13T12:00:00Z' })
    await expect(canRegenerateProgram(addiction.id)).resolves.toEqual({ allowed: true })
  })

  it('autorise le premier programme seulement après une lecture confirmant son absence', async () => {
    readsFixture({ current: null, generatedAt: null })
    await expect(canRegenerateProgram(addiction.id)).resolves.toEqual({ allowed: true })
  })

  it.each(['', 'invalide', '2026-02-31T00:00:00Z', '2026-11-13T12:00:00Z'])(
    'refuse de décider avec une date invalide ou future : %s', async generatedAt => {
      readsFixture({ generatedAt })
      await expect(canRegenerateProgram(addiction.id)).rejects.toThrow(ProgramReadError)
    },
  )

  it('ne transforme pas les erreurs de base en absence ni en autorisation', async () => {
    readsFixture({ currentError: true, metadataError: true })
    await expect(getLatestProgram(addiction.id)).rejects.toThrow(ProgramReadError)
    await expect(canRegenerateProgram(addiction.id)).rejects.toThrow(ProgramReadError)
  })

  it('masque aussi une exception de transport sans ouvrir la régénération', async () => {
    services.server.mockRejectedValue(new Error('SECRET-TRANSPORT'))
    await expect(getLatestProgram(addiction.id)).rejects.toThrow('Lecture du programme indisponible. Réessaie.')
    await expect(canRegenerateProgram(addiction.id)).rejects.toThrow('Lecture du programme indisponible. Réessaie.')
  })
})

describe('Vraie route de génération et normalisation', () => {
  it('renvoie done après une sauvegarde sans plantes et résume la version stockée', async () => {
    readsFixture({ generatedAt: null })
    const { plants_info: omitted, ...withoutPlants } = fixture()
    void omitted
    streamFixture(withoutPlants)
    const normalized = { ...fixture(), plants_info: [], intention: 'Intention sauvegardée' }
    const query = queryDouble()
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    query.single.mockResolvedValue({ data: row(normalized), error: null })
    services.admin.mockReturnValue({ from: vi.fn(() => query) })
    const result = await POST(request())
    expect(result.status).toBe(200)
    const body = await result.text()
    expect(body).toContain('event: done')
    expect(body).not.toContain('event: error')
    expect(body).toContain('"plants":0')
    expect(body).toContain('Intention sauvegardée')
    expect(query.insert).toHaveBeenCalledOnce()
    expect(query.insert.mock.calls[0][0].opus_response.plants_info).toEqual([])
  })

  it.each([
    { metadataError: true }, { generatedAt: 'date-invalide' }, { ownerError: true },
  ])('retourne 503 avant tout flux quand la vérification échoue : %j', async options => {
    readsFixture(options)
    const result = await POST(request())
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('SECRET')
    expect(services.stream).not.toHaveBeenCalled()
    expect(services.admin).not.toHaveBeenCalled()
  })

  it('refuse une génération prématurée même si le contenu existant est invalide', async () => {
    readsFixture({ current: row({}), generatedAt: '2026-11-11T00:00:00Z' })
    const result = await POST(request())
    expect(result.status).toBe(409)
    expect(services.stream).not.toHaveBeenCalled()
    expect(services.admin).not.toHaveBeenCalled()
  })

  it('ne sauvegarde pas une sortie malformée et ne diffuse pas son texte privé', async () => {
    readsFixture({ generatedAt: null })
    streamFixture({ intention: 'SECRET-RETOUR-LLM' })
    const result = await POST(request())
    const body = await result.text()
    expect(body).toContain('event: error')
    expect(body).not.toContain('event: done')
    expect(body).not.toContain('SECRET-RETOUR-LLM')
    expect(services.admin).not.toHaveBeenCalled()
  })
})

describe('Vraie page détail et récupération du programme', () => {
  async function renderPage() {
    render(await AddictionDetailPage({ params: Promise.resolve({ addictionId: addiction.id }) }))
  }

  it('affiche une issue et la date du délai sans présenter le JSON invalide ni un bouton de génération', async () => {
    readsFixture({ current: row({ intention: 'SECRET-HISTORIQUE' }), generatedAt: '2026-11-11T12:00:00Z' })
    await renderPage()
    expect(screen.getByText(/L’ancien programme ne peut pas être affiché/)).toBeTruthy()
    expect(screen.getByText(/Le délai habituel de régénération est conservé/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Réessayer' }).getAttribute('href')).toBe(`/dashboard/liberation/${addiction.id}`)
    expect(screen.queryByTestId('program-view-double')).toBeNull()
    expect(document.body.textContent).not.toContain('SECRET-HISTORIQUE')
  })

  it('rend de nouveau accessible la génération après le délai, sans envoyer le contenu invalide au lecteur', async () => {
    readsFixture({ current: row({ intention: 'SECRET-HISTORIQUE' }), generatedAt: '2026-10-01T00:00:00Z' })
    await renderPage()
    expect(screen.getByRole('button', { name: 'Générer le programme de test' })).toBeTruthy()
    expect(services.programView.mock.calls[0][0]).toMatchObject({ currentProgram: null, canRegenerate: true })
    expect(document.body.textContent).not.toContain('SECRET-HISTORIQUE')
  })

  it.each([{ currentError: true }, { metadataError: true }])(
    'propose de réessayer après une panne sans l’assimiler à un premier programme : %j', async options => {
      readsFixture(options)
      await renderPage()
      expect(screen.getByText('Programme temporairement indisponible')).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Réessayer' })).toBeTruthy()
      expect(screen.queryByTestId('program-view-double')).toBeNull()
      expect(document.body.textContent).not.toContain('SECRET')
    },
  )

  it('respecte le délai même si la lecture du contenu ne retrouve pas le programme', async () => {
    readsFixture({ current: null, generatedAt: '2026-11-11T00:00:00Z' })
    await renderPage()
    expect(screen.getByText(/Une nouvelle génération sera disponible/)).toBeTruthy()
    expect(screen.queryByTestId('program-view-double')).toBeNull()
  })
})


