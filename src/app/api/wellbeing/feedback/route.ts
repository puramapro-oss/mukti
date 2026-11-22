import { NextResponse } from 'next/server'
import { z } from 'zod'
import { wellbeingProfile } from '@/lib/wellbeing-auth'
import { FeedbackInput } from '@/lib/wellbeing-state'
import { getWellbeingFeedback, saveWellbeingFeedback, deleteWellbeingFeedback, resumeWellbeingSuggestion } from '@/lib/wellbeing'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET() {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: 'Connexion requise.' }, profile.status)
    return reply({ ok: true, ...await getWellbeingFeedback(profile.id) })
  } catch { return reply({ error: 'Retours indisponibles. Réessaie.' }, 503) }
}

export async function POST(req: Request) {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: 'Connexion requise.' }, profile.status)
    const parsed = FeedbackInput.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return reply({ error: 'Retour invalide ou accord manquant.' }, 400)
    if (!rateLimit(`wellbeing:feedback:${profile.id}`, 40, 3600).ok) return reply({ error: 'Trop de demandes. Réessaie plus tard.' }, 429)
    const result = await saveWellbeingFeedback(profile.id, parsed.data)
    return reply(result, result.status)
  } catch { return reply({ error: 'Retour non enregistré. Réessaie.' }, 503) }
}

const ResumeInput = z.object({ variant: z.enum(['calm', 'focus', 'sleep', 'ignite']), resume: z.literal(true) }).strict()
export async function PATCH(req: Request) {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: 'Connexion requise.' }, profile.status)
    const parsed = ResumeInput.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return reply({ error: 'Choix invalide.' }, 400)
    await resumeWellbeingSuggestion(profile.id, parsed.data.variant)
    return reply({ ok: true })
  } catch { return reply({ error: 'Reprise des suggestions non confirmée. Réessaie.' }, 503) }
}

export async function DELETE() {
  try {
    const profile = await wellbeingProfile()
    if (!profile.id) return reply({ error: 'Connexion requise.' }, profile.status)
    await deleteWellbeingFeedback(profile.id)
    return reply({ ok: true })
  } catch { return reply({ error: 'Suppression non confirmée. Réessaie.' }, 503) }
}
