import { describe, expect, it } from 'vitest'
import {
  createRitualPlan,
  ritualCueAt,
  serializeRitualPlan,
  type RitualDraft,
} from '../../src/lib/aurora-ritual'
import { AURORA_PHASES } from '../../src/lib/constants/aurora'

const draft: RitualDraft = {
  intention: 'Avancer sur mon projet',
  outcome: 'Un premier brouillon utile',
  obstacle: 'Je remets le début à plus tard',
  response: 'J’ouvre mon document',
  action: 'Écrire la première phrase',
  context: 'Demain matin, à mon bureau',
  mode: 'factuel',
}

const tinyDraft: RitualDraft = {
  intention: 'Écrire',
  outcome: 'Clarté',
  obstacle: 'Doute',
  response: 'Essayer',
  action: 'Écrire',
  context: 'Ici',
  mode: 'factuel',
}

describe('AURORA intention-to-action plan', () => {
  it('keeps the real AURORA duration and an ordered, usable eight-step script', () => {
    const duration = AURORA_PHASES.focus.reduce((sum, phase) => sum + phase.duration_sec, 0)
    const plan = createRitualPlan(draft, duration)
    expect(plan.id).toBe('intention-action')
    expect(plan.version).toBe(1)
    expect(plan.durationSec).toBe(248)
    expect(plan.cues.map((cue) => cue.id)).toEqual([
      'installation', 'intention', 'obstacle', 'if-then', 'process',
      'encouragement', 'next-step', 'return',
    ])
    expect(plan.cues[0].at).toBe(0)
    expect(new Set(plan.cues.map((cue) => cue.id)).size).toBe(plan.cues.length)
    expect(plan.cues[0].text).toContain('Respire naturellement')
    expect(plan.cues[4].text).toContain('les décrire avec des mots')
    for (let index = 0; index < plan.cues.length; index += 1) {
      const cue = plan.cues[index]
      const end = plan.cues[index + 1]?.at ?? plan.durationSec
      const slot = end - cue.at
      const words = cue.text.trim().split(/\s+/u).length
      // Every slot allows at least a slow reading and reflection, without
      // asserting an exact internal scheduling formula or device TTS speed.
      expect(Number.isInteger(cue.at)).toBe(true)
      expect(slot).toBeGreaterThan(words / 2 + 4)
      expect(cue.at).toBeLessThan(plan.durationSec)
    }
    expect(plan.cues[1].text).toContain(draft.intention)
    expect(plan.cues[1].text).toContain(draft.outcome)
    expect(plan.cues[2].text).toContain(draft.obstacle)
    expect(plan.cues[3].text).toContain(draft.response)
    expect(plan.cues[6].text).toContain(draft.action)
    expect(plan.cues[6].text).toContain(draft.context)
    expect(plan.cues[6].text).toContain('réalisation restera à confirmer')
  })

  it('uses only the actual variant durations, including the brief format when it fits', () => {
    const durations = Object.values(AURORA_PHASES)
      .map((phases) => phases.reduce((sum, phase) => sum + phase.duration_sec, 0))
      .sort((a, b) => a - b)
    expect(durations).toEqual([128, 248, 468, 608])
    for (const duration of durations) {
      const plan = createRitualPlan(tinyDraft, duration)
      expect(plan.durationSec).toBe(duration)
      expect(plan.cues[plan.cues.length - 1].at).toBeLessThan(duration)
    }
  })

  it.each([NaN, Infinity, -Infinity, -1, 0, 120, 248.5, 600, 609, '248'])
  ('rejects an unsupported or invalid duration (%s)', (duration) => {
    expect(() => createRitualPlan(draft, duration as number)).toThrow('Durée AURORA invalide')
  })

  it.each(['intention', 'outcome', 'obstacle', 'response', 'action', 'context'] as const)
  ('requires readable, bounded text for %s', (field) => {
    for (const value of [undefined, null, 42, false, {}, []]) {
      expect(() => createRitualPlan({ ...draft, [field]: value } as RitualDraft, 608))
        .toThrow('saisis un texte')
    }
    expect(() => createRitualPlan({ ...draft, [field]: ' \n\t ' }, 608))
      .toThrow('ce champ est requis')
    expect(() => createRitualPlan({ ...draft, [field]: 'a'.repeat(161) }, 608))
      .toThrow('160 caractères')
    const plan = createRitualPlan({ ...draft, [field]: 'a'.repeat(160) }, 608)
    expect(plan.draft[field]).toHaveLength(160)
  })

  it('normalizes whitespace and Unicode without silently shortening meaningful content', () => {
    const input = { ...draft, intention: ' \tCre\u0301er\n mon   projet  ' }
    const plan = createRitualPlan(input, 248)
    expect(plan.draft.intention).toBe('Créer mon projet')
    expect(input.intention).toBe(' \tCre\u0301er\n mon   projet  ')
    expect(createRitualPlan({ ...draft, action: '🌱'.repeat(160) }, 608).draft.action)
      .toBe('🌱'.repeat(160))
    expect(() => createRitualPlan({ ...draft, action: '🌱'.repeat(161) }, 608))
      .toThrow('160 caractères')
  })

  it.each(['\u0000', '\u202E', '\u2066'])('rejects hidden control characters', (character) => {
    expect(() => createRitualPlan({ ...draft, intention: `Mon ${character}projet` }, 248))
      .toThrow('caractères de contrôle')
  })

  it.each([undefined, null, [], 'projet'])('rejects an invalid draft container', (value) => {
    expect(() => createRitualPlan(value as unknown as RitualDraft, 248))
      .toThrow('Prépare une intention')
  })

  it.each(['inconnu', '', null, 1, 'Factuel', ' factuel'])('rejects an unknown mode (%s)', (mode) => {
    expect(() => createRitualPlan({ ...draft, mode } as RitualDraft, 248))
      .toThrow('Choisis un mode')
  })

  it('keeps spiritual and symbolic suggestions optional and tied to the chosen mode', () => {
    const factual = createRitualPlan(draft, 248)
    const mixed = createRitualPlan({ ...draft, mode: 'mixte' }, 248)
    const spiritual = createRitualPlan({ ...draft, mode: 'spirituel' }, 248)
    expect(factual.cues[5].text).not.toMatch(/spirituel|geste/)
    expect(mixed.cues[5].text).toContain('Si tu le souhaites')
    expect(mixed.cues[5].text).toContain('geste personnel')
    expect(spiritual.cues[5].text).toContain('Si tu le souhaites')
    expect(spiritual.cues[5].text).toContain('intention spirituelle')
    expect(spiritual.cues[5].text).toContain('rester en silence')
  })

  it('rejects a script that cannot fit without truncation or faster speech', () => {
    const long = 'Un pas à la fois. '.repeat(8).trim()
    const detailed: RitualDraft = {
      intention: long, outcome: long, obstacle: long, response: long,
      action: long, context: long, mode: 'spirituel',
    }
    expect(() => createRitualPlan(detailed, 128)).toThrow(/Texte trop long.*Choisis au moins.*raccourcis/)
    expect(() => createRitualPlan(detailed, 248)).toThrow('Texte trop long')
    const plan = createRitualPlan(detailed, 608)
    expect(plan.draft).toEqual(detailed)
    expect(plan.cues[4].text).toContain(long)
  })

  it('also budgets unusually long tokens instead of counting each as one short word', () => {
    const unspaced = {
      intention: 'a'.repeat(160), outcome: 'b'.repeat(160), obstacle: 'c'.repeat(160),
      response: 'd'.repeat(160), action: 'e'.repeat(160), context: 'f'.repeat(160),
      mode: 'factuel' as const,
    }
    expect(() => createRitualPlan(unspaced, 128)).toThrow('Texte trop long')
    expect(createRitualPlan(unspaced, 608).draft.action).toBe(unspaced.action)
  })

  it('is deterministic and isolates snapshots from caller mutations and other plans', () => {
    const input = { ...draft }
    const first = createRitualPlan(input, 248)
    const second = createRitualPlan(input, 248)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.draft).not.toBe(first.draft)
    expect(second.cues).not.toBe(first.cues)
    expect(second.cues[0]).not.toBe(first.cues[0])
    input.action = 'Une autre action'
    expect(first.draft.action).toBe(draft.action)
    expect(first.cues[4].text).toContain(draft.action)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.draft)).toBe(true)
    expect(Object.isFrozen(first.cues)).toBe(true)
    expect(first.cues.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Reflect.set(first.draft, 'action', 'Modifiée')).toBe(false)
    expect(Reflect.set(first.cues[0], 'text', 'Modifié')).toBe(false)
  })

  it('selects the correct cue exactly at a boundary and clamps finite outside times', () => {
    const plan = createRitualPlan(draft, 248)
    expect(ritualCueAt(plan, -100)).toBe(plan.cues[0])
    expect(ritualCueAt(plan, 0)).toBe(plan.cues[0])
    for (let index = 1; index < plan.cues.length; index += 1) {
      const cue = plan.cues[index]
      expect(ritualCueAt(plan, cue.at - 0.001)).toBe(plan.cues[index - 1])
      expect(ritualCueAt(plan, cue.at)).toBe(cue)
    }
    expect(ritualCueAt(plan, plan.durationSec)).toBe(plan.cues[plan.cues.length - 1])
    expect(ritualCueAt(plan, Number.MAX_VALUE)).toBe(plan.cues[plan.cues.length - 1])
  })

  it.each([NaN, Infinity, -Infinity, undefined, null, '1'])('rejects an invalid clock (%s)', (time) => {
    expect(() => ritualCueAt(createRitualPlan(draft, 248), time as number))
      .toThrow('Temps de séance invalide')
  })

  it('exports a readable personal plan with a planned action, never inferred completion', () => {
    const plan = createRitualPlan(draft, 248)
    const before = JSON.stringify(plan)
    const text = serializeRitualPlan(plan)
    expect(text).toContain('4 min 8 s (248 secondes)')
    expect(text).toContain('Confidentialité')
    expect(text).toContain('Son partage reste ton choix')
    expect(text).toContain('Statut de l’action : prévue.')
    expect(text).toContain('ne valide ni une écoute ni la réalisation d’un objectif')
    expect(text).toContain(`Action prévue : ${draft.action}`)
    for (const cue of plan.cues) expect(text).toContain(cue.text)
    expect(text).not.toContain('Action accomplie')
    expect(text).not.toContain('Objectif atteint')
    expect(serializeRitualPlan(plan)).toBe(text)
    expect(JSON.stringify(plan)).toBe(before)
  })
})
