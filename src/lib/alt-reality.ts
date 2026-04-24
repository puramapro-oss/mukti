// MUKTI — G6 Mode 17 Réalité Alternative
// Projection visuelle "toi sans addiction dans X jours" via Pollinations Flux + Claude prompt.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import { ALT_REALITY_HORIZONS, type AltRealityHorizon } from './constants'

export interface AltRealitySession {
  id: string
  user_id: string
  projection_horizon_days: number
  addiction_id: string | null
  projection_url: string | null
  projection_prompt: string | null
  mood_before: number | null
  mood_after: number | null
  duration_sec: number | null
  created_at: string
}

export function isValidHorizon(days: number): days is AltRealityHorizon {
  return (ALT_REALITY_HORIZONS as readonly { days: number }[]).some(h => h.days === days)
}

export function getHorizonMeta(days: AltRealityHorizon) {
  return ALT_REALITY_HORIZONS.find(h => h.days === days) ?? null
}

interface PromptSpec {
  visual_prompt_en: string
  tagline_fr: string
}

/** Generate a visual projection prompt via Claude for a given addiction + horizon. */
async function generateProjectionPrompt(
  addictionType: string | null,
  horizon: AltRealityHorizon
): Promise<PromptSpec | null> {
  const prompt = `Génère un prompt visuel anglais pour Flux (Pollinations AI) illustrant une personne libérée de son addiction dans ${horizon} jours.

ADDICTION : ${addictionType ?? 'générique / multi-addictions'}
HORIZON : ${horizon} jours

Règles :
- Portrait réaliste, lumineux, visage serein, peau claire, regard vif
- Couleurs douces (bleu nuit #0A0A0F, violet #7c3aed, cyan #06b6d4)
- Ambiance : "before/after transformation", "healthy glow", "inner peace"
- Max 200 caractères anglais
- JAMAIS inclure : addiction name, substance, cigarette, alcohol visible — seulement LE VISAGE LIBÉRÉ

Réponds en JSON :
{
  "visual_prompt_en": "prompt anglais max 200c pour Flux",
  "tagline_fr": "1 phrase FR poétique à afficher sous l'image, max 80c"
}`

  return await askClaudeJSON<PromptSpec>({
    prompt,
    model: process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5-20251001',
    maxTokens: 512,
  })
}

function pollinationsUrl(promptEn: string): string {
  const encoded = encodeURIComponent(promptEn)
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1536&model=flux&enhance=true&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`
}

export interface ProjectInput {
  horizon: AltRealityHorizon
  addiction_id?: string | null
  mood_before?: number
}

export async function createProjection(input: ProjectInput): Promise<{
  session: AltRealitySession | null
  error: string | null
}> {
  if (!isValidHorizon(input.horizon)) {
    return { session: null, error: 'Horizon invalide.' }
  }
  if (input.mood_before != null && (input.mood_before < 1 || input.mood_before > 10)) {
    return { session: null, error: 'Humeur entre 1 et 10.' }
  }

  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { session: null, error: 'Profil introuvable — reconnecte-toi.' }

  const sb = createServiceClient()

  // Resolve addiction type if provided
  let addictionType: string | null = null
  if (input.addiction_id) {
    const { data: addiction } = await sb
      .schema('mukti')
      .from('addictions')
      .select('id, type, user_id')
      .eq('id', input.addiction_id)
      .eq('user_id', profileId)
      .maybeSingle()
    if (!addiction) return { session: null, error: 'Addiction introuvable ou non autorisée.' }
    addictionType = (addiction as { type: string }).type
  }

  const spec = await generateProjectionPrompt(addictionType, input.horizon)
  if (!spec) return { session: null, error: "Impossible de générer la projection." }

  const url = pollinationsUrl(spec.visual_prompt_en)

  const { data, error } = await sb
    .schema('mukti')
    .from('alt_reality_sessions')
    .insert({
      user_id: profileId,
      projection_horizon_days: input.horizon,
      addiction_id: input.addiction_id ?? null,
      projection_url: url,
      projection_prompt: spec.tagline_fr,
      mood_before: input.mood_before ?? null,
    })
    .select('*')
    .single()
  if (error || !data) {
    return { session: null, error: "Impossible d'enregistrer la projection." }
  }
  return { session: data as AltRealitySession, error: null }
}

export async function listProjections(limit: number = 10): Promise<AltRealitySession[]> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return []
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('alt_reality_sessions')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)))
  return (data ?? []) as AltRealitySession[]
}

async function resolveProfileId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}
