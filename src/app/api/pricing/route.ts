// GET /api/pricing — prix EFFECTIFS publics (1 source de vérité runtime, cf
// lib/admin-settings.ts getEffectivePricing). Consommé par la page publique
// /pricing pour ne jamais afficher un prix différent de celui réellement facturé
// par Stripe checkout (audit CONFORMITE.md 2026-08-23, écart #8).

import { NextResponse } from 'next/server'
import { getEffectivePricing } from '@/lib/admin-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pricing = await getEffectivePricing()
  return NextResponse.json(pricing)
}
