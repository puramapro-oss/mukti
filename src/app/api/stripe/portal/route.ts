import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createPortalSession } from '@/lib/stripe'
import { APP_URL } from '@/lib/constants'

export const runtime = 'nodejs'

export async function POST() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif.' }, { status: 400 })
  }

  const session = await createPortalSession(profile.stripe_customer_id, `${APP_URL}/dashboard`)
  return NextResponse.json({ url: session.url })
}
