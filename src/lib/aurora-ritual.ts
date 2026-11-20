/**
 * AURORA — De l'intention à l'action.
 * Original PURAMA wording; deterministic composition, not a validated treatment.
 * Process rehearsal: Pham & Taylor (1999), doi:10.1177/0146167299025002010.
 * Mental contrasting + if/then plans: Wang et al. (2021),
 * doi:10.3389/fpsyg.2021.565202. These findings do not validate this whole ritual.
 * No network, persistence, automatic action completion, or reward side effects.
 */

export type RitualMode = 'factuel' | 'mixte' | 'spirituel'

export type RitualDraft = {
  intention: string
  outcome: string
  obstacle: string
  response: string
  action: string
  context: string
  mode: RitualMode
}

export type RitualCue = {
  id: string
  at: number
  title: string
  text: string
}

export type RitualPlan = {
  id: 'intention-action'
  version: 1
  draft: RitualDraft
  durationSec: number
  cues: readonly RitualCue[]
}

// Real total durations of the existing AURORA variants, including their intro.
const DURATIONS = [128, 248, 468, 608] as const
const MODES: readonly RitualMode[] = ['factuel', 'mixte', 'spirituel']
const FIELD_LABELS = {
  intention: 'Intention',
  outcome: 'Résultat souhaité',
  obstacle: 'Obstacle',
  response: 'Réponse prévue',
  action: 'Action prévue',
  context: 'Moment et lieu',
} as const
const MAX_FIELD_LENGTH = 160

function normalizeField(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} : saisis un texte.`)
  }
  const text = value.normalize('NFC').trim().replace(/\s+/gu, ' ')
  if (!text) {
    throw new Error(`${label} : ce champ est requis.`)
  }
  if (Array.from(text).length > MAX_FIELD_LENGTH) {
    throw new Error(`${label} : limite de ${MAX_FIELD_LENGTH} caractères. Raccourcis ce champ.`)
  }
  // Tabs/newlines have already become spaces; do not allow invisible controls
  // or directional overrides to disguise the content of the exported text.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(text)) {
    throw new Error(`${label} : retire les caractères de contrôle invisibles.`)
  }
  return text
}

function normalizeDraft(draft: RitualDraft): RitualDraft {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new Error('Prépare une intention et une prochaine action avant de commencer.')
  }
  if (!MODES.includes(draft.mode)) {
    throw new Error('Choisis un mode : factuel, mixte ou spirituel.')
  }
  // Copy only the known fields. Do not retain or freeze the caller's object.
  return Object.freeze({
    intention: normalizeField(draft.intention, FIELD_LABELS.intention),
    outcome: normalizeField(draft.outcome, FIELD_LABELS.outcome),
    obstacle: normalizeField(draft.obstacle, FIELD_LABELS.obstacle),
    response: normalizeField(draft.response, FIELD_LABELS.response),
    action: normalizeField(draft.action, FIELD_LABELS.action),
    context: normalizeField(draft.context, FIELD_LABELS.context),
    mode: draft.mode,
  })
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`
}

/**
 * Conservative scheduling budget, not a guarantee about a device's TTS speed:
 * at most 120 words/min or 12 characters/sec, then 20% headroom and four
 * seconds to reflect. The character bound also covers unusually long tokens.
 * Playback must still handle actual speech completion/interruption itself.
 */
function minimumCueSeconds(text: string): number {
  const words = text.trim().split(/\s+/u).length
  const characters = Array.from(text).length
  const readingSeconds = Math.max(words / 2, characters / 12)
  return Math.ceil(readingSeconds * 1.2) + 4
}

function encouragement(mode: RitualMode): string {
  if (mode === 'spirituel') {
    return 'Si tu le souhaites, choisis un geste ou une intention spirituelle pour cet engagement. Tu peux aussi rester en silence.'
  }
  if (mode === 'mixte') {
    return 'Un pas réaliste suffit pour commencer. Si tu le souhaites, choisis un geste personnel qui symbolise cet engagement.'
  }
  return 'Tu peux avancer par un pas réaliste. Tu peux aussi ajuster ton plan ou te reposer.'
}

/** Creates an immutable snapshot; never shortens user meaning to fit a slot. */
export function createRitualPlan(draft: RitualDraft, durationSec: number): RitualPlan {
  if (!Number.isFinite(durationSec) || !DURATIONS.some((duration) => duration === durationSec)) {
    throw new Error('Durée AURORA invalide. Choisis 2 min 8 s, 4 min 8 s, 7 min 48 s ou 10 min 8 s.')
  }
  const snapshot = normalizeDraft(draft)
  const content: Omit<RitualCue, 'at'>[] = [
    {
      id: 'installation',
      title: 'Installation',
      text: 'Installe-toi confortablement. Respire naturellement. Tu peux garder les yeux ouverts, utiliser des mots ou simplement écouter.',
    },
    {
      id: 'intention',
      title: 'Intention et résultat souhaité',
      text: `Intention : « ${snapshot.intention} ». Résultat souhaité : « ${snapshot.outcome} ». Observe ce qui compte pour toi.`,
    },
    {
      id: 'obstacle',
      title: 'Un obstacle concret',
      text: `Obstacle identifié : « ${snapshot.obstacle} ». Distingue ce qui dépend de toi des contraintes extérieures. Tu peux adapter ton projet.`,
    },
    {
      id: 'if-then',
      title: 'Ton plan si… alors…',
      text: `Si cet obstacle se présente, alors voici ta réponse prévue : « ${snapshot.response} ». Tu peux la réviser.`,
    },
    {
      id: 'process',
      title: 'Répéter le premier pas',
      text: `Répète mentalement ce premier pas : « ${snapshot.action} ». Tu peux imaginer les gestes ou les décrire avec des mots.`,
    },
    {
      id: 'encouragement',
      title: snapshot.mode === 'factuel' ? 'Un encouragement réaliste' : 'Un engagement personnel',
      text: encouragement(snapshot.mode),
    },
    {
      id: 'next-step',
      title: 'Le prochain pas, quand et où',
      text: `Action prévue : « ${snapshot.action} ». Moment et lieu : « ${snapshot.context} ». Sa réalisation restera à confirmer.`,
    },
    {
      id: 'return',
      title: 'Retour',
      text: 'Reviens doucement à ton environnement. Garde le prochain pas qui te convient. Tu peux aussi adapter ton projet.',
    },
  ]
  const minimums = content.map((cue) => minimumCueSeconds(cue.text))
  const minimumDuration = minimums.reduce((total, seconds) => total + seconds, 0)
  if (minimumDuration > durationSec) {
    const longerDuration = DURATIONS.find((duration) => duration > durationSec && duration >= minimumDuration)
    const alternative = longerDuration
      ? `Choisis au moins ${formatDuration(longerDuration)} ou raccourcis les champs.`
      : 'Raccourcis les champs avant de commencer.'
    throw new Error(`Texte trop long pour ${formatDuration(durationSec)} : prévois au moins ${formatDuration(minimumDuration)} de lecture et de pauses. ${alternative}`)
  }

  // Distribute the remaining reflection time evenly, using integer boundaries
  // so every cue fits and the final slot ends exactly at the chosen duration.
  const spare = durationSec - minimumDuration
  let at = 0
  const cues = content.map((cue, index) => {
    const timedCue = Object.freeze({ ...cue, at })
    const extra = Math.floor(spare * (index + 1) / content.length)
      - Math.floor(spare * index / content.length)
    at += minimums[index] + extra
    return timedCue
  })
  return Object.freeze({
    id: 'intention-action',
    version: 1,
    draft: snapshot,
    durationSec,
    cues: Object.freeze(cues),
  })
}

/** Finite times outside the session are clamped; invalid clock values fail. */
export function ritualCueAt(plan: RitualPlan, elapsedSec: number): RitualCue {
  if (typeof elapsedSec !== 'number' || !Number.isFinite(elapsedSec)) {
    throw new Error('Temps de séance invalide : utilise un nombre de secondes fini.')
  }
  if (!plan || !Array.isArray(plan.cues) || plan.cues.length === 0) {
    throw new Error('Le plan de séance ne contient aucune étape.')
  }
  const elapsed = Math.max(0, Math.min(elapsedSec, plan.durationSec))
  for (let index = plan.cues.length - 1; index >= 0; index -= 1) {
    if (plan.cues[index].at <= elapsed) return plan.cues[index]
  }
  return plan.cues[0]
}

/** Plain-text export only: no save, share, tracking, or completion side effect. */
export function serializeRitualPlan(plan: RitualPlan): string {
  return [
    'PURAMA — AURORA — De l’intention à l’action',
    `Version : ${plan.version}`,
    `Durée prévue : ${formatDuration(plan.durationSec)} (${plan.durationSec} secondes)`,
    `Mode : ${plan.draft.mode}`,
    '',
    'Confidentialité : ce texte contient tes objectifs personnels. Son partage reste ton choix.',
    'Progression : ce document décrit une séance prévue. Il ne valide ni une écoute ni la réalisation d’un objectif.',
    'Statut de l’action : prévue.',
    '',
    ...Object.entries(FIELD_LABELS).map(([key, label]) => `${label} : ${plan.draft[key as keyof typeof FIELD_LABELS]}`),
    '',
    ...plan.cues.flatMap((cue, index) => [
      `${index + 1}. ${cue.title} — à ${formatDuration(cue.at)}`,
      cue.text,
      '',
    ]),
    'Après la séance : confirme toi-même ce que tu as essayé et adapte le prochain pas si nécessaire.',
  ].join('\n')
}
