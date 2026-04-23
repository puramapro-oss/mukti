// GET /api/ar/species — liste publique 7 espèces actives (ordre sort_order)

import { NextResponse } from 'next/server'
import { listSpecies } from '@/lib/ar'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const result = await listSpecies()
  if (!result.ok) {
    return NextResponse.json({ error: 'Impossible de charger les espèces.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, species: result.species })
}
