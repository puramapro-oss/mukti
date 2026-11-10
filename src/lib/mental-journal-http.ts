import { NextResponse } from 'next/server'
import { JournalError } from './mental-journal-contract'

export function journalErrorResponse(error: unknown): NextResponse {
  const known = error instanceof JournalError
  return NextResponse.json(
    { error: known ? error.message : 'Le journal est momentanément indisponible. Réessaie dans un instant.' },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

/** Bound the actual stream before JSON parsing, even without Content-Length. */
export async function readJournalBody(req: Request, maxBytes: number): Promise<unknown> {
  if ((req.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new JournalError(415, 'Une requête JSON est requise.')
  }
  const declared = req.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new JournalError(413, 'Le contenu du journal est trop volumineux.')
  }
  const reader = req.body?.getReader()
  if (!reader) throw new JournalError(400, 'Requête vide.')
  const parts: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      if (req.signal.aborted) throw new JournalError(408, 'Requête interrompue.')
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        throw new JournalError(413, 'Le contenu du journal est trop volumineux.')
      }
      parts.push(chunk.value)
    }
    const joined = new Uint8Array(bytes)
    let offset = 0
    for (const part of parts) { joined.set(part, offset); offset += part.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown
  } catch (error) {
    if (error instanceof JournalError) throw error
    throw new JournalError(400, 'Requête JSON invalide.')
  } finally { reader.releaseLock() }
}
