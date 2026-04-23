import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    all: z.boolean().optional(),
  })
  .refine((d) => (d.ids && d.ids.length > 0) || d.all === true, {
    message: 'Aucune notification à marquer.',
  })

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })

  const query = admin
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .eq('read', false)

  const { data, error } = parsed.data.all
    ? await query.select('id')
    : await query.in('id', parsed.data.ids ?? []).select('id')

  if (error) {
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: data?.length ?? 0 })
}
