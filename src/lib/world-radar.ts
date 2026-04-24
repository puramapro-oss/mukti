// MUKTI — G6 World Radar IA
// Scan global crises via Tavily API + classify via Claude Haiku + auto-publish rules.
// CRON 15min : /api/cron/core-world-radar.

import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import {
  CORE_WORLD_RADAR_QUERIES,
  CORE_WORLD_RADAR_CONFIDENCE_AUTO,
  CORE_WORLD_RADAR_CONFIDENCE_MOD,
  type CoreFormat,
  type CoreCategory,
} from './constants'
import { defaultProtocolForFormat } from './core-protocols'
import { createTrilogySessions } from './core-events'

interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

interface TavilyResponse {
  query: string
  results: TavilySearchResult[]
  answer?: string
}

export interface RadarClassification {
  is_crisis: boolean
  format: CoreFormat
  category: CoreCategory
  severity: number // 1-5
  title_fr: string
  title_en: string
  intention_fr: string
  intention_en: string
  region: string | null
  confidence: number // 0-1
  rationale: string
}

async function tavilySearch(query: string): Promise<TavilyResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        topic: 'news',
        max_results: 5,
        days: 1,
      }),
      // 20s timeout guard
      signal: AbortSignal.timeout(20000),
    })
    if (!resp.ok) return null
    return (await resp.json()) as TavilyResponse
  } catch {
    return null
  }
}

/** Classify a Tavily result into a C.O.R.E. RadarClassification via Haiku. */
async function classifyViaHaiku(result: TavilySearchResult): Promise<RadarClassification | null> {
  const prompt = `Analyse cet article d'actualité et détermine s'il décrit une crise justifiant un événement C.O.R.E. de soin collectif.

ARTICLE :
Titre : ${result.title}
Contenu : ${result.content.slice(0, 1500)}
Publié : ${result.published_date ?? 'inconnu'}

Réponds UNIQUEMENT en JSON avec ce schéma exact :
{
  "is_crisis": boolean,
  "format": "human" | "animal" | "one_planet",
  "category": "crisis_humanitarian" | "crisis_natural" | "crisis_conflict" | "animal_refuge" | "animal_wildlife" | "animal_rescue" | "collective_healing" | "planetary_sync",
  "severity": 1-5,
  "title_fr": "max 100c, sobre, factuel",
  "title_en": "max 100c, factual, no sensationalism",
  "intention_fr": "2-5 mots, ex: PAIX, APAISEMENT, PROTECTION, SOUTIEN",
  "intention_en": "2-5 mots",
  "region": "pays ou zone ou null",
  "confidence": 0-1 (nombre décimal),
  "rationale": "pourquoi cette classification en 1 phrase"
}

Règles strictes :
- is_crisis=false si l'article n'est pas une vraie crise humanitaire/animale/naturelle.
- intention en UN SEUL MOT grand (ex: "APAISEMENT" pas "Apaiser le monde")
- Jamais de wording médical ("guérir", "soigner") — toujours "soutien", "accompagnement", "apaisement"
- Sévérité 5 = événement mondial majeur (tremblement de terre M7+, guerre active, extinction massive)
- confidence = 0.9+ si source fiable ET sévérité claire ; 0.5-0.85 si incertitude ; <0.5 si doute`

  return await askClaudeJSON<RadarClassification>({
    prompt,
    model: process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
  })
}

export interface ScanResult {
  queries_ran: number
  raw_results: number
  crises_detected: number
  auto_published: number
  moderation_queued: number
  drafts_created: number
  errors: string[]
}

/** Full radar scan pipeline. Called by CRON. */
export async function scanWorldCrises(): Promise<ScanResult> {
  const sb = createServiceClient()
  const stats: ScanResult = {
    queries_ran: 0,
    raw_results: 0,
    crises_detected: 0,
    auto_published: 0,
    moderation_queued: 0,
    drafts_created: 0,
    errors: [],
  }
  const createdEventIds: string[] = []

  for (const query of CORE_WORLD_RADAR_QUERIES) {
    stats.queries_ran += 1
    const resp = await tavilySearch(query)
    if (!resp) {
      stats.errors.push(`Tavily failed: ${query}`)
      continue
    }
    const results = resp.results.slice(0, 3)
    stats.raw_results += results.length

    for (const r of results) {
      const existing = await sb
        .schema('mukti')
        .from('core_events')
        .select('id')
        .eq('title_en', r.title.slice(0, 140))
        .maybeSingle()
      if (existing.data) continue

      const cls = await classifyViaHaiku(r)
      if (!cls || !cls.is_crisis) continue
      stats.crises_detected += 1

      let status: 'draft' | 'scheduled' = 'draft'
      let autoPublished = false
      if (cls.confidence >= CORE_WORLD_RADAR_CONFIDENCE_AUTO) {
        status = 'scheduled'
        autoPublished = true
        stats.auto_published += 1
      } else if (cls.confidence >= CORE_WORLD_RADAR_CONFIDENCE_MOD) {
        stats.moderation_queued += 1
      } else {
        stats.drafts_created += 1
      }

      const momentZ = computeOptimalMomentZ(cls.severity)
      const protocolId = defaultProtocolForFormat(cls.format)

      const { data } = await sb
        .schema('mukti')
        .from('core_events')
        .insert({
          format: cls.format,
          category: cls.category,
          severity: cls.severity,
          title_fr: cls.title_fr.slice(0, 140),
          title_en: cls.title_en.slice(0, 140),
          intention_fr: cls.intention_fr.slice(0, 80),
          intention_en: cls.intention_en.slice(0, 80),
          region: cls.region,
          moment_z_at: momentZ.toISOString(),
          ar_protocol_id: protocolId,
          source: 'world_radar',
          confidence: cls.confidence,
          status,
          auto_published: autoPublished,
          ai_pack: { rationale: cls.rationale, raw_url: r.url, raw_title: r.title },
        })
        .select('id')
        .single()
      if (data?.id) {
        createdEventIds.push(data.id as string)
        if (autoPublished) {
          await createTrilogySessions(data.id as string, momentZ, protocolId)
        }
      }
    }
  }

  // Log audit trail
  await sb.schema('mukti').from('core_world_radar_logs').insert({
    source_queries: [...CORE_WORLD_RADAR_QUERIES],
    n_events_found: stats.raw_results,
    events_created: createdEventIds.length,
    events_moderated: stats.moderation_queued,
    errors: stats.errors,
  })

  return stats
}

/** Compute next optimal Moment Z slot based on severity (urgent → soon; mild → next 24h). */
function computeOptimalMomentZ(severity: number): Date {
  const now = Date.now()
  const minDelayHours = severity >= 4 ? 2 : severity === 3 ? 6 : 12
  const targetTs = now + minDelayHours * 3600 * 1000
  // Round to next 15-min slot
  const slot = 15 * 60 * 1000
  return new Date(Math.ceil(targetTs / slot) * slot)
}
