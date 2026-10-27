/** Explicit SDK/network/media doubles. No live service, phone or physical audio output. */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export function loadSource(name, imports = {}, globals = {}) {
  const filename = fileURLToPath(new URL('../../' + name, import.meta.url))
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, URL, DOMException, AbortController, Uint8Array, TextDecoder, Error,
    setTimeout, clearTimeout,
    require: (specifier) => {
      if (!(specifier in imports)) throw new Error('Unexpected dependency: ' + specifier)
      return imports[specifier]
    },
    ...globals,
  }, { filename })
  return exports
}

export const events = Object.fromEntries([
  'TrackPublished', 'TrackSubscribed', 'TrackUnsubscribed', 'AudioPlaybackStatusChanged',
  'Reconnecting', 'Reconnected', 'Disconnected',
].map((name) => [name, name]))
export function listenerFixture(options = {}) {
  const calls = [], rooms = [], states = [], errors = [], inserted = [], timers = new Map()
  let timerId = 0, microphoneAccess = 0
  const defaults = { ok: true, token: 'test-token', url: 'wss://relay.test', listenOnly: true }
  const globalValues = {
    fetch: async (url, init) => {
      calls.push({ url, init })
      if (options.fetch) return options.fetch(url, init)
      return { ok: options.httpOk ?? true, json: async () => options.result ?? defaults }
    },
    setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id },
    clearTimeout: (id) => timers.delete(id),
    document: { body: { appendChild: (element) => inserted.push(element) } },
  }
  class Room {
    constructor() {
      rooms.push(this)
      this.handlers = new Map()
      this.remoteParticipants = options.participants ?? new Map()
      this.canPlaybackAudio = true
      this.disconnects = 0
      this.audioStarts = 0
    }
    get localParticipant() { microphoneAccess++; throw new Error('Listener accessed publishing API') }
    on(name, handler) { this.handlers.set(name, handler); return this }
    emit(name, ...args) { this.handlers.get(name)?.(...args) }
    removeAllListeners() { this.handlers.clear() }
    async connect(url, token, settings) {
      this.connection = { url, token, settings }
      if (options.connect) await options.connect()
    }
    async disconnect() { this.disconnects++ }
    async startAudio() { this.audioStarts++; if (options.startAudio) await options.startAudio() }
  }
  const transport = loadSource('src/lib/aurora-session-api.ts', {}, globalValues)
  const source = loadSource('src/lib/circle-listener.ts', {
    'livekit-client': { Room, RoomEvent: events, Track: { Kind: { Audio: 'audio' } } },
    './aurora-session-api': transport,
  }, globalValues)
  const handle = source.createCircleListener({ circleId: 'test-circle', volume: options.volume,
    onState: (state) => states.push(state), onError: (message) => errors.push(message) })
  return { handle, calls, rooms, states, errors, inserted, timers,
    microphoneAccess: () => microphoneAccess,
    expire: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn() } },
  }
}
export function audioTrack({ kind = 'audio', rejectPlay = false, failPause = false } = {}) {
  const elements = []
  return {
    kind, elements,
    attach() {
      const element = { volume: 1, srcObject: {}, removed: false, pauses: 0,
        setAttribute() {},
        play: async () => { if (rejectPlay) throw new Error('gesture required') },
        pause() { this.pauses++; if (failPause) throw new Error('pause failed') },
        remove() { this.removed = true },
      }
      elements.push(element)
      return element
    },
    detach() { return elements },
  }
}

export function serverFixture(options = {}) {
  const issued = [], queried = []
  class AccessToken {
    constructor(key, secret, settings) { this.settings = settings; this.credentials = [key, secret] }
    addGrant(grant) { this.grant = grant }
    async toJwt() { issued.push(this); return JSON.stringify({ settings: this.settings, grant: this.grant }) }
  }
  const livekit = loadSource('src/lib/livekit.ts', {
    'livekit-server-sdk': { AccessToken },
    './circles': { livekitRoomName: (id) => 'test-room-' + id },
  }, { process: { env: options.configured === false ? {} : {
    LIVEKIT_URL: 'wss://relay.test', LIVEKIT_API_KEY: 'test-only', LIVEKIT_API_SECRET: 'test-only-secret',
  } } })
  const data = {
    circle_participants: { id: 'participant', mic_muted: false, role: 'member' },
    circles: { audio_mode: 'sfu', status: 'live', livekit_room_name: null },
    profiles: { full_name: 'Test listener' },
    ...options.data,
  }
  const service = { from: (table) => {
    queried.push(table)
    const chain = { select: () => chain, eq: () => chain, is: () => chain,
      maybeSingle: async () => ({ data: data[table] }) }
    return chain
  } }
  const route = loadSource('src/app/api/circles/[id]/livekit-token/route.ts', {
    'next/server': { NextResponse: { json: (value, init) => ({ data: JSON.parse(JSON.stringify(value)), status: init?.status ?? 200, headers: new Headers(init?.headers) }) } },
    '@/lib/supabase-server': { createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: {
      user: options.authenticated === false ? null : { id: 'test-user', email: 'test@example.invalid' },
    } }) } }) },
    '@/lib/supabase': { createServiceClient: () => service },
    '@/lib/livekit': livekit,
    '@/lib/rate-limit': { getClientIp: () => '127.0.0.1', rateLimit: () => ({ ok: options.rateLimited !== true, retryAfterSec: 60 }) },
  })
  const request = (body, id = 'test-circle') => route.POST(new Request('https://app.test/token', {
    method: 'POST', ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), { params: Promise.resolve({ id }) })
  return { livekit, route, request, issued, queried }
}
