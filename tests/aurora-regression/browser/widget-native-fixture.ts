import type { Page } from '@playwright/test'
import type { WidgetPayload } from '../../../src/lib/affirmation-widget'

interface SimulatedWidgetState {
  supported: boolean
  configured: boolean
  installed: boolean
  payload?: string
}
interface WidgetNativeFixture {
  state: SimulatedWidgetState
  failRead: boolean
  failWrite: boolean
  pinSupported: boolean
  pinDelayMs: number
  reads: number
  writes: number
  pins: number
  resume: () => void
}
declare global { interface Window { __widgetNativeFixture: WidgetNativeFixture } }

/** Explicit test double at the Capacitor transport boundary; no real device is implied. */
export async function installWidgetNativeFixture(page: Page, options: { saved?: WidgetPayload; failRead?: boolean } = {}) {
  await page.addInitScript(({ payload, failRead }) => {
    const listeners = new Map<string, (state: { isActive: boolean }) => void>()
    let nextListener = 0
    const fixture: WidgetNativeFixture = {
      state: { supported: true, configured: Boolean(payload), installed: false, ...(payload ? { payload } : {}) },
      failRead: Boolean(failRead), failWrite: false, pinSupported: true, pinDelayMs: 0,
      reads: 0, writes: 0, pins: 0,
      resume: () => { for (const listener of listeners.values()) listener({ isActive: true }) },
    }
    Object.assign(window, {
      androidBridge: {},
      __widgetNativeFixture: fixture,
      Capacitor: {
        PluginHeaders: [
          { name: 'AffirmationWidget', methods: ['getState', 'configure', 'clear', 'requestPin'].map(name => ({ name, rtype: 'promise' })) },
          { name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] },
        ],
        nativePromise: async (plugin: string, method: string, args?: { payload?: string; callbackId?: string }) => {
          if (plugin === 'App' && method === 'removeListener') { listeners.delete(args?.callbackId ?? ''); return }
          if (plugin !== 'AffirmationWidget') throw new Error(`Unexpected simulated plugin: ${plugin}`)
          if (method === 'getState') {
            fixture.reads++
            if (fixture.failRead) throw new Error('Lecture du téléphone indisponible (simulation).')
            return { ...fixture.state }
          }
          if (method === 'configure') {
            fixture.writes++
            if (fixture.failWrite) throw new Error('Enregistrement simulé non confirmé.')
            fixture.state = { ...fixture.state, configured: true, payload: args?.payload }
            return { saved: true }
          }
          if (method === 'clear') {
            fixture.state = { supported: true, configured: false, installed: fixture.state.installed }
            return { cleared: true }
          }
          if (method === 'requestPin') {
            fixture.pins++
            if (fixture.pinDelayMs) await new Promise(resolve => setTimeout(resolve, fixture.pinDelayMs))
            return { requested: fixture.pinSupported }
          }
          throw new Error(`Unexpected simulated method: ${method}`)
        },
        nativeCallback: (plugin: string, method: string, args: { eventName: string }, callback: (state: { isActive: boolean }) => void) => {
          if (plugin !== 'App' || method !== 'addListener' || args.eventName !== 'appStateChange') throw new Error('Unexpected simulated listener')
          const id = String(++nextListener)
          listeners.set(id, callback)
          return id
        },
      },
    })
  }, { payload: options.saved ? JSON.stringify(options.saved) : undefined, failRead: options.failRead })
}
