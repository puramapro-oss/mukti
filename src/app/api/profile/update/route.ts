import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

const THEMES = ['dark', 'light', 'auto'] as const

const SituationSchema = z
  .object({
    emploi: z.enum(['salarie', 'cadre', 'independant', 'fonctionnaire', 'chomeur', 'etudiant', 'retraite', 'sans_emploi', 'frontalier']).optional(),
    pays_frontalier: z.enum(['CH', 'LU', 'DE', 'BE', 'IT', 'ES', 'MC', 'AD']).nullable().optional(),
    revenus_mensuels_nets: z.number().min(0).max(1000000).optional(),
    revenus_annuels_bruts: z.number().min(0).max(10000000).optional(),
    logement: z.enum(['locataire', 'proprietaire', 'heberge', 'sans_domicile']).optional(),
    loyer_mensuel: z.number().min(0).max(50000).optional(),
    famille: z.enum(['celibataire', 'couple', 'pacs', 'marie', 'divorce', 'veuf']).optional(),
    enfants: z.number().int().min(0).max(20).optional(),
    enfants_a_charge: z.number().int().min(0).max(20).optional(),
    handicap: z.boolean().optional(),
    handicap_taux: z.number().int().min(0).max(100).optional(),
    region: z.string().max(80).optional(),
    age: z.number().int().min(16).max(120).optional(),
  })
  .partial()

const AddressSchema = z
  .object({
    street: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    zip: z.string().max(20).optional(),
    country: z.string().max(80).optional(),
  })
  .partial()

const BodySchema = z
  .object({
    full_name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().max(30).optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    address: AddressSchema.optional(),
    situation: SituationSchema.optional(),
    language: z.string().max(5).optional(),
    theme: z.enum(THEMES).optional(),
    iban: z.string().trim().max(40).optional().or(z.literal('')),
    onboarded: z.boolean().optional(),
    tutorial_completed: z.boolean().optional(),
  })
  .strict()

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue
    patch[k] = v === '' ? null : v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('auth_user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Impossible de mettre à jour le profil.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, profile: data })
}
