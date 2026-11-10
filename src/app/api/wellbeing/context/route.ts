import { NextResponse } from 'next/server'
import { wellbeingProfile } from '@/lib/wellbeing-auth'
import { WellbeingInput } from '@/lib/wellbeing-state'
import { normalizeTimeZone } from '@/lib/wellbeing-date'
import { getWellbeingContext, saveWellbeingContext, deleteWellbeingContext } from '@/lib/wellbeing'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(req: Request) {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: profile.status === 401 ? 'Connexion requise.' : 'Connexion indisponible.' }, profile.status)
    let zone: string
    try { zone = normalizeTimeZone(new URL(req.url).searchParams.get('time_zone')) }
    catch { return reply({ error: 'Fuseau horaire invalide.' }, 400) }
    return reply({ ok: true, ...await getWellbeingContext(profile.id, zone) })
  } catch { return reply({ error: 'Disponibilité du jour indisponible. Réessaie.' }, 503) }
}

export async function PUT(req: Request) {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: profile.status === 401 ? 'Connexion requise.' : 'Connexion indisponible.' }, profile.status)
    const parsed = WellbeingInput.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return reply({ error: 'Choix invalides ou accord manquant.' }, 400)
    const limit = rateLimit(`wellbeing:context:${profile.id}`, 60, 3600)
    if (!limit.ok) return reply({ error: 'Trop de modifications. Réessaie plus tard.' }, 429)
    return reply({ ok: true, ...await saveWellbeingContext(profile.id, parsed.data) })
  } catch { return reply({ error: 'Enregistrement non confirmé. Tes choix restent affichés pour réessayer.' }, 503) }
}

export async function DELETE() {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: 'Connexion requise.' }, profile.status)
    await deleteWellbeingContext(profile.id)
    return reply({ ok: true })
  } catch { return reply({ error: 'Suppression non confirmée. Réessaie.' }, 503) }
}
