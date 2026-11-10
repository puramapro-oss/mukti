/** Bounded requests. Cancellation never proves that a server-side write was undone. */
export async function wellbeingRequest<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const mutation = !['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())
  const interruptedMessage = mutation
    ? 'Requête interrompue. Enregistrement non confirmé.'
    : 'Lecture interrompue. Réessaie.'
  if (signal?.aborted) throw new Error(interruptedMessage)

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  let rejectAbort!: (error: Error) => void
  const interrupted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const onAbort = () => rejectAbort(new Error(timedOut
    ? mutation ? 'Délai dépassé. Enregistrement non confirmé.' : 'Délai de lecture dépassé. Réessaie.'
    : interruptedMessage))
  controller.signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10_000)

  const request = async () => {
    let response: Response
    try {
      response = await fetch(url, {
        ...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      })
    } catch {
      throw new Error(mutation
        ? 'Connexion interrompue. Enregistrement non confirmé.'
        : 'Connexion interrompue. Lecture indisponible.')
    }
    const body: unknown = await response.json().catch(() => null)
    if (controller.signal.aborted) throw new Error(interruptedMessage)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Réponse invalide. Réessaie.')
    }
    const object = body as Record<string, unknown>
    if (!response.ok || object.ok !== true) {
      throw new Error(typeof object.error === 'string' ? object.error : 'Réponse invalide. Réessaie.')
    }
    return body as T
  }

  try {
    // Settles even when a transport or a delayed JSON body ignores AbortSignal.
    return await Promise.race([request(), interrupted])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
  }
}
