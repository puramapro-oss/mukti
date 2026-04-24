// MUKTI — G7 Ambassadeurs : 8 paliers Bronze→Éternel, auto-upgrade, plan gratuit.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { AmbassadorTierSlug } from './constants'

export interface AmbassadorTier {
  slug: AmbassadorTierSlug
  name_fr: string
  name_en: string
  threshold_conversions: number
  commission_rate_pct: number
  plan_granted: string | null
  perks: string[]
  ordinal: number
}

export interface AmbassadeurProfile {
  user_id: string
  tier_slug: AmbassadorTierSlug
  conversions_count: number
  total_earned_cents: number
  plan_granted: string | null
  approved_at: string | null
  bio: string | null
  social_links: Record<string, string>
}

export async function listTiersPublic(): Promise<AmbassadorTier[]> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('ambassador_tiers')
    .select('*')
    .order('ordinal', { ascending: true })
  return (data ?? []) as unknown as AmbassadorTier[]
}

export async function getMyAmbassadeurProfile(): Promise<AmbassadeurProfile | null> {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return null
  const { data } = await sb.from('ambassadeur_profiles').select('*').eq('user_id', profileId).maybeSingle()
  return (data as unknown as AmbassadeurProfile | null) ?? null
}

export async function applyAmbassadeur(params: {
  bio: string
  socialLinks: Record<string, string>
}): Promise<{ ok: boolean; tier: AmbassadorTierSlug; approved: boolean; error?: string }> {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return { ok: false, tier: 'bronze', approved: false, error: 'Connexion requise.' }
  const admin = createServiceClient()
  const { count } = await admin
    .from('referrals_v4')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', profileId)
    .eq('status', 'active')
  const conversions = count ?? 0
  const tiers = await listTiersPublic()
  const unlocked = tiers.filter(t => conversions >= t.threshold_conversions).pop()
  const tier_slug = unlocked?.slug ?? 'bronze'
  const shouldApprove = conversions >= (tiers.find(t => t.slug === 'bronze')?.threshold_conversions ?? 10)
  await admin.from('ambassadeur_profiles').upsert({
    user_id: profileId,
    tier_slug,
    conversions_count: conversions,
    bio: params.bio,
    social_links: params.socialLinks,
    approved_at: shouldApprove ? new Date().toISOString() : null,
    plan_granted: unlocked?.plan_granted ?? null,
  }, { onConflict: 'user_id' })
  await admin.from('profiles').update({ is_ambassador: shouldApprove }).eq('id', profileId)
  return { ok: true, tier: tier_slug, approved: shouldApprove }
}

export async function upgradeTierIfEligible(userId: string): Promise<{ upgraded: boolean; newTier: AmbassadorTierSlug | null }> {
  const admin = createServiceClient()
  const [{ count }, { data: current }] = await Promise.all([
    admin.from('referrals_v4').select('id', { count: 'exact', head: true }).eq('referrer_id', userId).eq('status', 'active'),
    admin.from('ambassadeur_profiles').select('tier_slug').eq('user_id', userId).maybeSingle(),
  ])
  const conv = count ?? 0
  const currentSlug = (current as { tier_slug: AmbassadorTierSlug } | null)?.tier_slug ?? null
  const tiers = await listTiersPublic()
  const unlocked = tiers.filter(t => conv >= t.threshold_conversions).pop()
  if (!unlocked) return { upgraded: false, newTier: null }
  if (currentSlug === unlocked.slug) return { upgraded: false, newTier: currentSlug }
  await admin.from('ambassadeur_profiles').update({
    tier_slug: unlocked.slug,
    conversions_count: conv,
    plan_granted: unlocked.plan_granted,
  }).eq('user_id', userId)
  return { upgraded: true, newTier: unlocked.slug }
}

export async function getAmbassadorLeaderboard(limit = 20): Promise<Array<{
  user_id: string
  tier_slug: AmbassadorTierSlug
  conversions_count: number
  total_earned_cents: number
}>> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('ambassadeur_profiles')
    .select('user_id, tier_slug, conversions_count, total_earned_cents')
    .not('approved_at', 'is', null)
    .order('total_earned_cents', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as Array<{
    user_id: string
    tier_slug: AmbassadorTierSlug
    conversions_count: number
    total_earned_cents: number
  }>
}
