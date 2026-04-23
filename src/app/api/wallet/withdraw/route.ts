import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 15

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/

const BodySchema = z.object({
  amount: z.number().min(5, 'Montant minimum : 5 €.').max(1000, 'Montant maximum : 1 000 €.'),
  iban: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, '').toUpperCase())
    .refine((s) => IBAN_REGEX.test(s), 'IBAN invalide. Format attendu : FR76…'),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const { amount, iban } = parsed.data

  const admin = createServiceClient()
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, wallet_balance')
    .eq('auth_user_id', user.id)
    .single()

  if (profErr || !profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const balance = Number(profile.wallet_balance ?? 0)
  if (amount > balance) {
    return NextResponse.json({ error: 'Solde insuffisant pour ce retrait.' }, { status: 400 })
  }

  const { count: pendingCount } = await admin
    .from('withdrawals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .in('status', ['pending', 'processing'])

  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Un retrait est déjà en cours de traitement.' }, { status: 409 })
  }

  const newBalance = balance - amount

  const { data: withdrawal, error: wErr } = await admin
    .from('withdrawals')
    .insert({ user_id: profile.id, amount, iban, status: 'pending' })
    .select('id, amount, status, requested_at')
    .single()

  if (wErr || !withdrawal) {
    return NextResponse.json({ error: "Impossible d'enregistrer la demande de retrait." }, { status: 500 })
  }

  await admin.from('profiles').update({ wallet_balance: newBalance, iban }).eq('id', profile.id)
  await admin.from('wallet_transactions').insert({
    user_id: profile.id,
    amount: -amount,
    type: 'withdrawal',
    source_id: withdrawal.id,
    description: 'Demande de retrait IBAN',
  })
  await admin.from('notifications').insert({
    user_id: profile.id,
    type: 'system',
    title: 'Demande de retrait enregistrée',
    body: `Ton retrait de ${amount.toFixed(2).replace('.', ',')} € est en cours de traitement (2-5 jours ouvrés).`,
    icon: '💸',
    action_url: '/dashboard/wallet',
  })

  return NextResponse.json({ ok: true, withdrawal, balance: newBalance })
}
