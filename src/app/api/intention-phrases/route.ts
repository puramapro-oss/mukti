// GET /api/intention-phrases?category= — liste phrases actives d'une catégorie

import { NextResponse } from 'next/server'
import { listPhrasesByCategory } from '@/lib/intention-phrases'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const CATEGORY_IDS = CIRCLE_CATEGORIES.map((c) => c.id) as string[]

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')

  if (!category || !CATEGORY_IDS.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide.' }, { status: 400 })
  }

  const phrases = await listPhrasesByCategory(category as CircleCategoryId)
  return NextResponse.json(
    { ok: true, phrases },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
  )
}
