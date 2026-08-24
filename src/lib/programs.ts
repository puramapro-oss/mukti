// MUKTI — Programme Libération (G2)
// Génération Claude Opus 4.7 structuré JSON + lecture + cooldown regen.
// Wording : JAMAIS "guérit/traite/soigne" — TOUJOURS "soutien/accompagnement/libération".

import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { ADDICTION_TYPES, PROGRAM_REGEN_COOLDOWN_DAYS } from './constants'
import type { Addiction } from './addictions'
import type {
  ProgramPhase,
  MicroMeditation,
  PlantInfo,
  AntiPulsionAction,
  HypnoseScript,
  ProgramStructure,
  StoredProgram,
} from './programs-types'
import { PROGRAM_TOOL_SCHEMA } from './programs-schema'

export type {
  ProgramPhase,
  MicroMeditation,
  PlantInfo,
  AntiPulsionAction,
  HypnoseScript,
  ProgramStructure,
  StoredProgram,
} from './programs-types'

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

function getOpusModel(): string {
  return process.env.ANTHROPIC_MODEL_PRO || 'claude-opus-4-7'
}

/** Le system prompt impose le wording non-médical + le schéma JSON strict. */
function buildSystemPrompt(): string {
  return `Tu es un accompagnant bienveillant en libération des addictions, expert en psychologie positive, méditation, hypnose éricksonienne, respiration consciente et rituels adaptatifs. Tu accompagnes les personnes sur le chemin de la libération sans jamais les juger.

RÈGLES ABSOLUES :
1. JAMAIS "guérit", "traite", "soigne une maladie", "thérapie médicale", "médecin". TOUJOURS "soutien", "accompagnement", "libération", "apaisement", "équilibre".
2. Aucune prescription médicale. Les plantes mentionnées sont PUREMENT INFORMATIVES ("à explorer avec un professionnel qualifié").
3. Si tu détectes une détresse extrême possible → mentionne dans emergency_message : 3114 (FR Suicide écoute) ou 112.
4. Tutoiement chaleureux, FR soutenu mais accessible.
5. Tout en français.
6. Zéro culpabilité. Chaque phrase respire l'acceptation inconditionnelle.
7. Réalisme : propose des rituels faisables en 30s-2min, pas de "médite 1h par jour".

TU DOIS répondre UNIQUEMENT en appelant l'outil produce_program avec le JSON complet et précis. Aucun texte hors de l'outil.`
}

function buildUserPrompt(addiction: Addiction): string {
  const meta = ADDICTION_TYPES.find(t => t.id === addiction.type)
  const label = addiction.custom_label || meta?.name || addiction.type
  return `Génère un programme de libération personnalisé sur 90 jours (3 phases) pour la personne suivante.

ADDICTION : ${label} (type interne: ${addiction.type})
SÉVÉRITÉ : ${addiction.severity}/5
FRÉQUENCE QUOTIDIENNE : ${addiction.frequency_daily ?? 'non renseignée'}
DEPUIS (mois) : ${addiction.started_ago_months ?? 'non renseigné'}
DÉCLENCHEURS CONNUS : ${addiction.triggers.length ? addiction.triggers.join(', ') : 'non renseignés'}
OBJECTIF : ${addiction.goal === 'stop' ? 'arrêt complet' : 'réduction progressive'}

Compose un programme 90 jours avec 3 phases (Libération initiale J1-7 / Consolidation J8-30 / Transformation J31-90), 4 à 6 micro-méditations (trigger + script 10-40s), 10+ affirmations libératrices, 3-5 plantes informatives, 5-10 actions anti-pulsion situationnelles, 2-3 protocoles respiratoires, 2-3 scripts d'hypnose courts, 5 triggers à risque, 5 marqueurs de succès, un message emergency_message (ressources si détresse).`
}

/**
 * Stream Opus 4.7 (tool-use forcé produce_program) — pour SSE UX premium.
 * Le consumer doit appeler `await stream.finalMessage()` pour récupérer le résultat complet.
 */
export function createOpusProgramStream(addiction: Addiction) {
  const anthropic = getAnthropic()
  return anthropic.messages.stream({
    model: getOpusModel(),
    max_tokens: 16384,
    system: buildSystemPrompt(),
    tools: [PROGRAM_TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: 'produce_program' },
    messages: [{ role: 'user', content: buildUserPrompt(addiction) }],
  })
}

export function getOpusModelName(): string {
  return getOpusModel()
}

/**
 * Génère le programme via Opus + force JSON-mode via tool_use forcé.
 * Retourne la structure parsée + usage tokens.
 */
export async function generateProgramForAddiction(addiction: Addiction): Promise<{
  program: ProgramStructure
  input_tokens: number
  output_tokens: number
  model: string
}> {
  const anthropic = getAnthropic()
  const model = getOpusModel()

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 16384,
    system: buildSystemPrompt(),
    tools: [PROGRAM_TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: 'produce_program' },
    messages: [{ role: 'user', content: buildUserPrompt(addiction) }],
  })

  const toolUse = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'produce_program'
  )
  if (!toolUse) throw new Error('Opus n\'a pas retourné la structure attendue.')

  const program = toolUse.input as ProgramStructure
  return {
    program,
    input_tokens: msg.usage.input_tokens,
    output_tokens: msg.usage.output_tokens,
    model,
  }
}

/** Lit le programme courant (is_current=true) d'une addiction — RLS owner-only. */
export async function getLatestProgram(addictionId: string): Promise<StoredProgram | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('addiction_id', addictionId)
    .eq('is_current', true)
    .maybeSingle()

  if (error || !data) return null
  return flattenProgramRow(data)
}

/**
 * Vérifie si l'utilisateur peut regénérer le programme :
 * - aucun programme existant → oui
 * - dernier généré > PROGRAM_REGEN_COOLDOWN_DAYS → oui
 * - sinon non avec `next_available_at`
 */
export async function canRegenerateProgram(addictionId: string): Promise<{
  allowed: boolean
  reason?: string
  next_available_at?: string
}> {
  const current = await getLatestProgram(addictionId)
  if (!current) return { allowed: true }

  const generated = new Date(current.generated_at).getTime()
  const cooldownMs = PROGRAM_REGEN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const nextMs = generated + cooldownMs

  if (Date.now() >= nextMs) return { allowed: true }
  return {
    allowed: false,
    reason: `Tu as déjà un programme généré — la regénération sera disponible tous les ${PROGRAM_REGEN_COOLDOWN_DAYS} jours.`,
    next_available_at: new Date(nextMs).toISOString(),
  }
}

/**
 * Persiste un programme généré (service-role requis : table RLS lecture seule user).
 * Marque automatiquement les anciennes versions is_current=false.
 */
export async function storeProgram(params: {
  addictionId: string
  userId: string
  program: ProgramStructure
  inputTokens: number
  outputTokens: number
  model: string
}): Promise<StoredProgram> {
  const admin = createServiceClient()

  await admin
    .from('programs')
    .update({ is_current: false })
    .eq('addiction_id', params.addictionId)

  const { data: existing } = await admin
    .from('programs')
    .select('version')
    .eq('addiction_id', params.addictionId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (existing?.version ?? 0) + 1

  const { data, error } = await admin
    .from('programs')
    .insert({
      addiction_id: params.addictionId,
      user_id: params.userId,
      version: nextVersion,
      model_used: params.model,
      opus_response: params.program,
      phases: params.program.phases,
      micro_meditations: params.program.micro_meditations,
      affirmations: params.program.affirmations,
      recommended_modes: params.program.recommended_modes,
      plants_info: params.program.plants_info,
      risk_triggers: params.program.risk_triggers,
      success_markers: params.program.success_markers,
      generation_tokens_input: params.inputTokens,
      generation_tokens_output: params.outputTokens,
      is_current: true,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(`Persistence programme échouée : ${error?.message}`)
  return flattenProgramRow(data)
}

type ProgramRow = {
  id: string
  addiction_id: string
  user_id: string
  version: number
  model_used: string
  generated_at: string
  is_current: boolean
  opus_response: ProgramStructure
}

function flattenProgramRow(row: ProgramRow): StoredProgram {
  return {
    ...row.opus_response,
    id: row.id,
    addiction_id: row.addiction_id,
    user_id: row.user_id,
    version: row.version,
    model_used: row.model_used,
    generated_at: row.generated_at,
    is_current: row.is_current,
  }
}
