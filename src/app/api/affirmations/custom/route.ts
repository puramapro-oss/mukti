// POST /api/affirmations/custom — crée une affirmation perso (max 100/catégorie)
// GET  /api/affirmations/custom — liste les affirmations perso actives de l'utilisateur

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCustomAffirmation, listCustomAffirmationsForCurrentUser, isValidCategory } from '@/lib/affirmations-bank'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

const CreateSchema = z.object({
  category: z.string().refine(isValidCategory, { message: 'Catégorie invalide.' }),
  text: z.string().trim().min(5, 'Ton affirmation est trop courte.').max(300, 'Trop long — garde ça sous 300 caractères.'),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour créer une affirmation perso.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`affirm:create:${user.id}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await createCustomAffirmation({
    category: parsed.data.category as Parameters<typeof createCustomAffirmation>[0]['category'],
    text: parsed.data.text,
  })

  if (result.error || !result.custom) {
    return NextResponse.json(
      { error: result.error ?? 'Impossible de sauvegarder.' },
      { status: result.error?.includes('authentifié') ? 401 : 400 }
    )
  }

  return NextResponse.json({ ok: true, custom: result.custom })
}

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour voir tes affirmations perso.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`affirm:list:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const result = await listCustomAffirmationsForCurrentUser()
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes('authentifié') ? 401 : 500 }
    )
  }

  return NextResponse.json({ ok: true, items: result.items })
}
