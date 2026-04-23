// GET /api/ar/beacons — liste publique des 20 beacons (refuges / ONG / éléments)
// Query : ?type=refuge_animalier|ong_nature|personne|planete|element
//         ?intention=paix|amour_soi|...
// Cache-Control public 1h — liste quasi statique.

import { NextResponse } from 'next/server'
import { listBeacons } from '@/lib/ar'
import { AR_BEACON_TYPES, type ArBeaconType } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const VALID_INTENTIONS = new Set([
  'abondance', 'amour_soi', 'apaisement', 'motivation', 'renouveau',
  'confiance', 'protection', 'alignement', 'paix', 'ancrage',
  'clarte', 'gratitude', 'liberation', 'manifestation',
])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const intention = url.searchParams.get('intention')

  const filters: { type?: ArBeaconType; intention_hint?: string } = {}
  if (type) {
    if (!AR_BEACON_TYPES.includes(type as ArBeaconType)) {
      return NextResponse.json({ error: 'Type de cible invalide.' }, { status: 400 })
    }
    filters.type = type as ArBeaconType
  }
  if (intention) {
    if (!VALID_INTENTIONS.has(intention)) {
      return NextResponse.json({ error: 'Intention invalide.' }, { status: 400 })
    }
    filters.intention_hint = intention
  }

  const result = await listBeacons(filters)
  if (!result.ok) {
    return NextResponse.json({ error: 'Impossible de charger les cibles.' }, { status: 500 })
  }
  return NextResponse.json(
    { ok: true, beacons: result.beacons },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' } },
  )
}
