/** JSON requests with a bounded wait. No automatic retry of a session mutation. */
export async function auroraRequest(
  url: string,
  init: RequestInit,
  controller: AbortController,
): Promise<Record<string, unknown>> {
  const { signal } = controller
  const abortError = () => new DOMException('Aborted', 'AbortError')
  if (signal.aborted) throw abortError()

  let onAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    // AbortSignal is forwarded, but also raced independently. A transport/body
    // reader ignoring abort must not leave the UI locked indefinitely.
    const read = async (): Promise<Record<string, unknown>> => {
      const response = await fetch(url, { ...init, signal })
      if (signal.aborted) throw abortError()
      const data: unknown = await response.json()
      if (signal.aborted) throw abortError()
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Réponse du serveur invalide. Réessaie.')
      }
      const result = data as Record<string, unknown>
      if (!response.ok || result.ok !== true) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Enregistrement non confirmé. Réessaie.')
      }
      return result
    }
    return await Promise.race([read(), cancelled])
  } finally {
    clearTimeout(timeout)
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}
