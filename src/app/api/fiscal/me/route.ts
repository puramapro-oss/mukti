import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { computeYearEarningsCents, upsertFiscalProfile } from '@/lib/fiscal'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const year = new Date().getUTCFullYear()
  const [total_ytd_cents, profile_type] = await Promise.all([
    computeYearEarningsCents(profileId, year),
    upsertFiscalProfile(profileId),
  ])
  return NextResponse.json({ year, total_ytd_cents, profile_type })
}
