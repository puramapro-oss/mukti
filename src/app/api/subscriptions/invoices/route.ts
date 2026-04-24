import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'
import { listCustomerInvoices } from '@/lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`invoices:${profileId}`, 30, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', profileId)
    .maybeSingle()
  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) return NextResponse.json({ invoices: [] })
  try {
    const invoices = await listCustomerInvoices(customerId, 24)
    return NextResponse.json({
      invoices: invoices.map(i => ({
        id: i.id,
        amount_paid: i.amount_paid,
        currency: i.currency,
        status: i.status,
        hosted_invoice_url: i.hosted_invoice_url,
        invoice_pdf: i.invoice_pdf,
        created: i.created,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
