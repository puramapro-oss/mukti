import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { createTextJournal, deleteEntry, getJournalContext, listEntries } from '@/lib/mental-journal'
import { JournalError, JOURNAL_MAX_TEXT_LENGTH, TextJournalSchema } from '@/lib/mental-journal-contract'
import { journalErrorResponse, readJournalBody } from '@/lib/mental-journal-http'

export const runtime = 'nodejs'
export const maxDuration = 30
const privateHeaders = { 'Cache-Control': 'private, no-store' }

function enforceRateLimit(userId: string, operation: string, max: number) {
  const limit = rateLimit(`journal:${operation}:${userId}`, max, 3600)
  if (!limit.ok) return NextResponse.json({ error: `Réessaie dans ${limit.retryAfterSec}s.` }, {
    status: 429, headers: { ...privateHeaders, 'Retry-After': String(limit.retryAfterSec) },
  })
  return null
}

export async function GET(req: Request) {
  try {
    const context = await getJournalContext()
    const limited = enforceRateLimit(context.userId, 'entries', 60)
    if (limited) return limited
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? '7')
    const entries = await listEntries(limit, context)
    return NextResponse.json({ entries }, { headers: privateHeaders })
  } catch (error) { return journalErrorResponse(error) }
}

export async function POST(req: Request) {
  try {
    const context = await getJournalContext()
    const limited = enforceRateLimit(context.userId, 'write', 20)
    if (limited) return limited
    const parsed = TextJournalSchema.safeParse(await readJournalBody(req, 4 * JOURNAL_MAX_TEXT_LENGTH + 2048))
    if (!parsed.success) throw new JournalError(400, 'Écris un texte de 1 à 8 000 caractères et vérifie les options choisies.')
    const result = await createTextJournal(parsed.data, { context, signal: req.signal })
    return NextResponse.json(result, { status: 201, headers: privateHeaders })
  } catch (error) { return journalErrorResponse(error) }
}

export async function DELETE(req: Request) {
  try {
    const context = await getJournalContext()
    const limited = enforceRateLimit(context.userId, 'delete', 60)
    if (limited) return limited
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(await readJournalBody(req, 1024))
    if (!parsed.success) throw new JournalError(400, "Identifiant d'entrée invalide.")
    await deleteEntry(parsed.data.id, context)
    return NextResponse.json({ ok: true, id: parsed.data.id }, { headers: privateHeaders })
  } catch (error) { return journalErrorResponse(error) }
}
