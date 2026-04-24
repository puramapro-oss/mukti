// MUKTI — G6 Event Pack AI
// Génère un Event Pack complet via Claude Opus 4.7 pour un événement C.O.R.E.
// Brief §3 : résumé, gravité, horaire optimal, intention unique, protocole AR, plan 3 sessions.

import { askClaudeJSON } from './claude'
import type { CoreEvent } from './core-events'
import type { CoreProtocolId } from './constants'

export interface EventPack {
  resume_fr: string
  resume_en: string
  severity: number
  intention_fr: string
  intention_en: string
  ar_protocol: CoreProtocolId
  timezones_fr: string[]
  now_plan_fr: string
  h24_plan_fr: string
  d7_plan_fr: string
  accessibility_notes_fr: string
}

/** Generate a full Event Pack via Claude Opus. Called by super_admin or /api/core/events/generate-ai. */
export async function generateEventPack(event: Pick<CoreEvent, 'format' | 'category' | 'severity' | 'title_fr' | 'title_en' | 'region'>): Promise<EventPack | null> {
  const prompt = `Tu es le directeur spirituel des événements C.O.R.E. de MUKTI (Collective Omni-Resonance Events). Génère un Event Pack complet pour cet événement.

ÉVÉNEMENT :
- Format : ${event.format} (human/animal/one_planet)
- Catégorie : ${event.category}
- Gravité : ${event.severity}/5
- Titre FR : ${event.title_fr}
- Titre EN : ${event.title_en}
- Région : ${event.region ?? 'mondiale'}

Génère un Event Pack JSON avec ce schéma EXACT :
{
  "resume_fr": "2-3 phrases factuelles, sans dramatisation",
  "resume_en": "2-3 sentences factual",
  "severity": ${event.severity},
  "intention_fr": "UN SEUL MOT (ex: APAISEMENT, PAIX, PROTECTION, SOUTIEN, STABILITÉ)",
  "intention_en": "UN SEUL MOT (ex: PEACE, CALM, PROTECTION, SUPPORT, STABILITY)",
  "ar_protocol": "un id parmi : panic_off_2min, ancrage_5min, recuperation_12min, sommeil_7min, coherence_10min, soutien_aidants_12min, animal_calm_5min, wildlife_urgence_7min, refuge_sature_10min, one_planet_sync_12min",
  "timezones_fr": ["3-5 fuseaux adaptés à la région — ex: 'Europe/Paris 19h00', 'America/New_York 13h00'"],
  "now_plan_fr": "1 phrase — que faire MAINTENANT (régulation choc)",
  "h24_plan_fr": "1 phrase — que faire dans 24h (récupération)",
  "d7_plan_fr": "1 phrase — que faire dans 7 jours (reconstruction)",
  "accessibility_notes_fr": "1 phrase — adaptations sourds/aveugles/non-lecteurs/anglophones/RTL"
}

Règles strictes :
- JAMAIS de langage médical ("guérir", "soigner") — toujours "soutien", "apaisement", "accompagnement"
- intention en UN SEUL MOT, en majuscules si possible
- protocol cohérent avec format : human → recuperation/sommeil/soutien_aidants, animal → animal_calm/wildlife/refuge, one_planet → one_planet_sync
- Ton sobre, digne, jamais sensationnaliste
- Retourne UNIQUEMENT le JSON, rien d'autre`

  const model = process.env.ANTHROPIC_MODEL_MAIN || 'claude-sonnet-4-6'

  return await askClaudeJSON<EventPack>({
    prompt,
    model,
    maxTokens: 2048,
  })
}
