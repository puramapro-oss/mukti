// Server-only OpenTimestamps HTTP boundary. No user-provided destinations.
export const OTS_CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
] as const
const calendarOrigins = new Set<string>([
  ...OTS_CALENDARS,
  'https://btc.calendar.catallaxy.com',
  'https://ots.btc.catallaxy.com',
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
])
export function allowedOtsCalendar(url: URL): boolean {
  return calendarOrigins.has(url.origin) && url.protocol === 'https:' &&
    !url.username && !url.password && !url.port && !url.search && !url.hash &&
    (url.pathname === '/' || url.pathname === '')
}
function allowedRequest(url: URL, method: string): boolean {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false
  if (calendarOrigins.has(url.origin)) {
    return (method === 'POST' && url.pathname === '/digest') ||
      (method === 'GET' && /^\/timestamp\/[0-9a-f]{64}$/.test(url.pathname))
  }
  return method === 'GET' && url.origin === 'https://blockstream.info' &&
    (/^\/api\/block-height\/[0-9]{1,8}$/.test(url.pathname) || /^\/api\/block\/[0-9a-f]{64}$/.test(url.pathname))
}

/** Deadline covers response headers AND streaming body. Redirects are refused. */
export async function requestOtsBytes(
  url: URL,
  body?: Uint8Array,
  timeoutMs = 3000,
  maxBytes = 65536,
): Promise<Uint8Array> {
  const method = body ? 'POST' : 'GET'
  if (!allowedRequest(url, method)) throw new Error('Unapproved timestamp endpoint')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 8000 ||
      !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 131072 ||
      (body && body.byteLength !== 32)) throw new Error('Invalid timestamp request bounds')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Timestamp request timed out'))
    }, timeoutMs)
  })
  const work = async () => {
    const response = await fetch(url, {
      method, signal: controller.signal, redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/vnd.opentimestamps.v1', 'Content-Type': 'application/octet-stream' },
      ...(body ? { body: new Uint8Array(body).buffer } : {}),
    })
    if (controller.signal.aborted || !response.ok || response.redirected || !response.body) throw new Error('Timestamp response unavailable')
    const length = response.headers.get('content-length')
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error('Timestamp response too large')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (controller.signal.aborted) throw new Error('Timestamp request cancelled')
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('Timestamp response too large')
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  }
  try { return await Promise.race([work(), deadline]) }
  finally {
    clearTimeout(timer)
    controller.abort()
    if (reader) void reader.cancel().catch(() => undefined)
  }
}
