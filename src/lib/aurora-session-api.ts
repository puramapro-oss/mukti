/** JSON requests with a bounded wait. No automatic retry of a session mutation. */
export async function auroraRequest(
  url: string,
  init: RequestInit,
  controller: AbortController,
): Promise<Record<string, unknown>> {
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const response = await fetch(url, { ...init, signal: controller.signal })
    const data: unknown = await response.json()
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Réponse du serveur invalide. Réessaie.')
    }
    const result = data as Record<string, unknown>
    if (!response.ok || result.ok !== true) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Enregistrement non confirmé. Réessaie.')
    }
    return result
  } finally {
    clearTimeout(timeout)
  }
}
