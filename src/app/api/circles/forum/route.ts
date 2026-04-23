// GET /api/circles/forum?category= — forum public de messages kind=forum (tous cercles d'une catégorie)
// L'utilisateur doit être authentifié, mais les messages sont publics (RLS kind=forum)

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const CATEGORY_IDS = CIRCLE_CATEGORIES.map((c) => c.id) as string[]

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10) || 30))

  if (!category || !CATEGORY_IDS.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  // Récupère les messages forum publics + noms auteurs via service client (index forum kind)
  const service = createServiceClient()
  // 1. Sélectionne cercles de la catégorie
  const { data: circles } = await service
    .from('circles')
    .select('id')
    .eq('category', category as CircleCategoryId)

  const circleIds = (circles ?? []).map((c: { id: string }) => c.id)
  if (circleIds.length === 0) {
    return NextResponse.json({ ok: true, messages: [] })
  }

  // 2. Sélectionne messages forum
  const { data: messages, error } = await service
    .from('circle_messages')
    .select('id, circle_id, user_id, content, created_at, reactions_count')
    .eq('kind', 'forum')
    .is('deleted_at', null)
    .in('circle_id', circleIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !messages) {
    return NextResponse.json({ error: 'Erreur chargement.' }, { status: 500 })
  }

  // 3. Fetch noms auteurs
  const authorIds = Array.from(new Set(messages.map((m: { user_id: string }) => m.user_id)))
  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name')
    .in('id', authorIds)

  const authorMap = new Map<string, string | null>()
  ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
    authorMap.set(p.id, p.full_name)
  })

  const enriched = messages.map((m: { id: string; circle_id: string; user_id: string; content: string; created_at: string; reactions_count: number }) => ({
    ...m,
    author_name: authorMap.get(m.user_id) ?? null,
  }))

  return NextResponse.json({ ok: true, messages: enriched })
}
