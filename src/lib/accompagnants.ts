// MUKTI G8.1 — Espace Accompagnants (profils aidants + ressources + NAMA-Aidant prompt)

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { AccompagnantSection, AidantLien } from './constants'
import { NAMA_AIDANT_PROMPT_FR } from './constants'

export interface AidantProfile {
  user_id: string
  lien_avec_malade: AidantLien
  situation: string | null
  energy_level: number
  consent_shared_stories: boolean
  created_at: string
  updated_at: string
}

export interface AccompagnantResource {
  id: string
  section_slug: AccompagnantSection
  title_fr: string
  title_en: string
  content_md_fr: string
  content_md_en: string | null
  video_url: string | null
  audio_url: string | null
  display_order: number
  active: boolean
}

export async function getAidantProfileForCurrentUser(): Promise<AidantProfile | null> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return null
  const { data } = await sb
    .from('accompagnants_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as AidantProfile | null) ?? null
}

export async function upsertAidantProfile(params: {
  lien_avec_malade: AidantLien
  situation?: string
  energy_level?: number
  consent_shared_stories?: boolean
}): Promise<AidantProfile | null> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return null
  const { data } = await sb
    .from('accompagnants_profiles')
    .upsert({
      user_id: userId,
      lien_avec_malade: params.lien_avec_malade,
      situation: params.situation ?? null,
      energy_level: params.energy_level ?? 50,
      consent_shared_stories: params.consent_shared_stories ?? false,
    }, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle()
  return (data as AidantProfile | null) ?? null
}

export async function getResourcesBySection(section: AccompagnantSection): Promise<AccompagnantResource[]> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('accompagnants_resources')
    .select('*')
    .eq('section_slug', section)
    .eq('active', true)
    .order('display_order', { ascending: true })
  return (data ?? []) as AccompagnantResource[]
}

export async function getAllResourcesGrouped(): Promise<Record<string, AccompagnantResource[]>> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('accompagnants_resources')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true })
  const rows = (data ?? []) as AccompagnantResource[]
  const grouped: Record<string, AccompagnantResource[]> = {}
  for (const r of rows) {
    if (!grouped[r.section_slug]) grouped[r.section_slug] = []
    grouped[r.section_slug].push(r)
  }
  return grouped
}

export interface TestimonialPublic {
  id: string
  content: string
  created_at: string
}

export async function listApprovedTestimonials(limit = 20): Promise<TestimonialPublic[]> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('accompagnants_testimonials')
    .select('id, content, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as TestimonialPublic[]
}

export async function submitTestimonial(content: string, anonymous = true): Promise<{ ok: boolean; id?: string }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { ok: false }
  if (content.trim().length < 20 || content.trim().length > 2000) return { ok: false }
  const { data } = await sb
    .from('accompagnants_testimonials')
    .insert({
      user_id: userId,
      content: content.trim(),
      anonymous,
      approved: false,
    })
    .select('id')
    .maybeSingle()
  return { ok: true, id: (data as { id: string } | null)?.id }
}

export function getNamaAidantSystemPrompt(): string {
  return NAMA_AIDANT_PROMPT_FR
}
