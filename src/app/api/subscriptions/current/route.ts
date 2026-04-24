import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getActiveSubscription } from '@/lib/subscriptions'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const sub = await getActiveSubscription()
  return NextResponse.json({ subscription: sub })
}
