// Compatibility URL: opt-in transcription and optional reflection, without inferred metrics.
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { analyzeAudioJournal, getJournalContext } from '@/lib/mental-journal'
import { AudioJournalSchema, JournalError, JOURNAL_MAX_AUDIO_BYTES } from '@/lib/mental-journal-contract'
import { journalErrorResponse, readJournalBody } from '@/lib/mental-journal-http'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(req: Request) {
  try {
    const context = await getJournalContext()
    const rl = rateLimit(`journal:audio:${context.userId}`, 10, 3600)
    if (!rl.ok) return NextResponse.json({ error: `Réessaie dans ${rl.retryAfterSec}s.` }, {
      status: 429, headers: { 'Retry-After': String(rl.retryAfterSec), 'Cache-Control': 'private, no-store' },
    })
    const parsed = AudioJournalSchema.safeParse(await readJournalBody(req, 4 * Math.ceil(JOURNAL_MAX_AUDIO_BYTES / 3) + 2048))
    if (!parsed.success) throw new JournalError(400, 'Audio invalide ou accord de transcription manquant.')
    const result = await analyzeAudioJournal(parsed.data, { context, signal: req.signal })
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return journalErrorResponse(error) }
}
