import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseWidgetPayload, type WidgetPayload } from './affirmation-widget'

export interface NativeWidgetState {
  supported: boolean
  configured: boolean
  installed?: boolean
  payload?: string
}
interface WidgetPlugin {
  getState(): Promise<NativeWidgetState>
  configure(options: { payload: string }): Promise<{ saved: boolean }>
  clear(): Promise<{ cleared: boolean }>
  requestPin(): Promise<{ requested: boolean }>
}
const widget = registerPlugin<WidgetPlugin>('AffirmationWidget')
export function widgetPlatform(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Le téléphone ne répond pas. État non confirmé : vérifie avant de réessayer.')), 10_000)
    })])
  } finally { if (timer) clearTimeout(timer) }
}

export async function readNativeWidget(): Promise<NativeWidgetState> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AffirmationWidget')) {
    return { supported: false, configured: false }
  }
  const state = await bounded(widget.getState())
  if (typeof state?.supported !== 'boolean' || typeof state.configured !== 'boolean') throw new Error('État du widget illisible.')
  if (state.installed !== undefined && typeof state.installed !== 'boolean') throw new Error('État du widget illisible.')
  if (!state.supported && (state.configured || state.installed === true)) throw new Error('État du widget incohérent.')
  if (state.configured) {
    if (typeof state.payload !== 'string') throw new Error('Sélection enregistrée illisible. Reconfigure le widget.')
    parseWidgetPayload(state.payload)
  }
  return state
}

/** A launcher request is not proof of installation; only getState reports widget presence.
 * @see https://developer.android.com/develop/ui/views/appwidgets/discoverability
 */
export async function requestNativeWidgetPin(): Promise<{ requested: boolean }> {
  if (!Capacitor.isNativePlatform() || widgetPlatform() !== 'android' || !Capacitor.isPluginAvailable('AffirmationWidget')) {
    return { requested: false }
  }
  const result = await bounded(widget.requestPin())
  if (typeof result?.requested !== 'boolean') throw new Error('Demande d’ajout non confirmée par le téléphone.')
  return { requested: result.requested }
}

export async function saveNativeWidget(payload: WidgetPayload): Promise<NativeWidgetState> {
  const serialized = JSON.stringify(payload)
  parseWidgetPayload(serialized)
  const result = await bounded(widget.configure({ payload: serialized }))
  if (result.saved !== true) throw new Error('Enregistrement non confirmé par le téléphone.')
  const state = await readNativeWidget()
  const saved = state.payload ? parseWidgetPayload(state.payload) : null
  if (!state.configured || !saved || saved.cadence !== payload.cadence || saved.configuredAt !== payload.configuredAt
    || saved.items.length !== payload.items.length || saved.items.some((item, index) =>
      item.id.toLowerCase() !== payload.items[index].id.toLowerCase() || item.text !== payload.items[index].text)) {
    throw new Error('Enregistrement non confirmé. Recharge les réglages pour vérifier.')
  }
  return state
}

export async function clearNativeWidget(): Promise<NativeWidgetState> {
  const result = await bounded(widget.clear())
  if (result.cleared !== true) throw new Error('Suppression non confirmée par le téléphone.')
  const state = await readNativeWidget()
  if (state.configured || state.payload) throw new Error('La sélection est encore présente. Réessaie de la retirer.')
  return state
}
