import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  isNativePlatform: vi.fn(), isPluginAvailable: vi.fn(), getPlatform: vi.fn(),
  getState: vi.fn(), configure: vi.fn(), clear: vi.fn(), requestPin: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: native,
  registerPlugin: () => ({ getState: native.getState, configure: native.configure, clear: native.clear, requestPin: native.requestPin }),
}))
import { clearNativeWidget, readNativeWidget, requestNativeWidgetPin, saveNativeWidget, widgetPlatform } from '../../src/lib/affirmation-widget-native'
import type { WidgetPayload } from '../../src/lib/affirmation-widget'

const payload: WidgetPayload = {
  schemaVersion: 1, cadence: 'daily', configuredAt: '2026-11-11T07:00:00.000Z',
  items: [{ id: '00000000-0000-4000-8000-000000000001', text: 'Je prends mon temps.' }],
}
beforeEach(() => {
  vi.clearAllMocks()
  native.isNativePlatform.mockReturnValue(true)
  native.isPluginAvailable.mockReturnValue(true)
  native.getPlatform.mockReturnValue('ios')
  native.getState.mockResolvedValue({ supported: true, configured: false })
  native.configure.mockResolvedValue({ saved: true })
  native.clear.mockResolvedValue({ cleared: true })
  native.requestPin.mockResolvedValue({ requested: false })
})

describe('truthful native acknowledgement', () => {
  it('does not claim native support on the web or an outdated wrapper', async () => {
    native.isNativePlatform.mockReturnValue(false)
    expect(await readNativeWidget()).toEqual({ supported: false, configured: false })
    native.isNativePlatform.mockReturnValue(true)
    native.isPluginAvailable.mockReturnValue(false)
    expect(await readNativeWidget()).toEqual({ supported: false, configured: false })
    expect(native.getState).not.toHaveBeenCalled()
    native.getPlatform.mockReturnValue('desktop')
    expect(widgetPlatform()).toBe('web')
    native.getPlatform.mockReturnValue('android')
    expect(widgetPlatform()).toBe('android')
  })

  it('requires valid readback after the write acknowledgement', async () => {
    native.getState.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(payload), installed: false })
    const state = await saveNativeWidget(payload)
    expect(native.configure).toHaveBeenCalledWith({ payload: JSON.stringify(payload) })
    expect(state.configured).toBe(true)
    expect(state.installed).toBe(false)
    native.getState.mockResolvedValue({ supported: true, configured: false })
    await expect(saveNativeWidget(payload)).rejects.toThrow('Enregistrement non confirmé')
  })

  it('never treats a saved:false or another snapshot as confirmed success', async () => {
    native.configure.mockResolvedValueOnce({ saved: false })
    await expect(saveNativeWidget(payload)).rejects.toThrow('Enregistrement non confirmé')
    expect(native.getState).not.toHaveBeenCalled()
    native.getState.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify({ ...payload, cadence: 'moments' }) })
    await expect(saveNativeWidget(payload)).rejects.toThrow('Enregistrement non confirmé')
  })

  it('accepts equivalent native JSON serialization but rejects changed phrase content', async () => {
    const nativeSerialization = JSON.stringify({
      items: payload.items.map(item => ({ text: item.text, id: item.id })),
      configuredAt: payload.configuredAt, cadence: payload.cadence, schemaVersion: payload.schemaVersion,
    }, null, 2)
    expect(nativeSerialization).not.toBe(JSON.stringify(payload))
    native.getState.mockResolvedValue({ supported: true, configured: true, payload: nativeSerialization })
    await expect(saveNativeWidget(payload)).resolves.toEqual(expect.objectContaining({ configured: true }))
    native.getState.mockResolvedValue({ supported: true, configured: true,
      payload: JSON.stringify({ ...payload, items: [{ ...payload.items[0], text: 'Un autre texte.' }] }) })
    await expect(saveNativeWidget(payload)).rejects.toThrow('Enregistrement non confirmé')
  })

  it('validates the DTO before calling the native writer', async () => {
    await expect(saveNativeWidget({ ...payload, items: [] })).rejects.toThrow('Sélection invalide')
    expect(native.configure).not.toHaveBeenCalled()
  })

  it.each([
    null, { supported: 'true', configured: false },
    { supported: true, configured: true },
    { supported: true, configured: true, payload: '{' },
  ])('rejects malformed state rather than showing success (%j)', async state => {
    native.getState.mockResolvedValue(state)
    await expect(readNativeWidget()).rejects.toThrow()
  })

  it.each([null, 'false', 0])('rejects a malformed optional installation flag (%j)', async installed => {
    native.getState.mockResolvedValue({ supported: true, configured: false, installed })
    await expect(readNativeWidget()).rejects.toThrow('État du widget illisible')
  })

  it.each([
    { supported: false, configured: true, payload: JSON.stringify(payload) },
    { supported: false, configured: false, installed: true },
  ])('rejects configuration or installation on an unsupported device (%j)', async state => {
    native.getState.mockResolvedValue(state)
    await expect(readNativeWidget()).rejects.toThrow('État du widget incohérent')
  })

  it('accepts an unsupported device without an installed widget', async () => {
    const state = { supported: false, configured: false, installed: false }
    native.getState.mockResolvedValue(state)
    await expect(readNativeWidget()).resolves.toEqual(state)
  })

  it('preserves installed presence after clearing the selection', async () => {
    const state = { supported: true, configured: false, installed: true }
    native.getState.mockResolvedValue(state)
    await expect(clearNativeWidget()).resolves.toEqual(state)
  })

  it('confirms removal only when acknowledgement and readback agree', async () => {
    expect(await clearNativeWidget()).toEqual({ supported: true, configured: false })
    native.clear.mockResolvedValueOnce({ cleared: false })
    await expect(clearNativeWidget()).rejects.toThrow('Suppression non confirmée')
    native.getState.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(payload) })
    await expect(clearNativeWidget()).rejects.toThrow('sélection est encore présente')
  })

  it('bounds an unresponsive bridge at ten seconds without claiming the late write was undone', async () => {
    vi.useFakeTimers()
    native.configure.mockReturnValue(new Promise(() => undefined))
    const result = expect(saveNativeWidget(payload)).rejects.toThrow('État non confirmé')
    await vi.advanceTimersByTimeAsync(10_000)
    await result
    expect(native.getState).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Android widget pin request', () => {
  beforeEach(() => { native.getPlatform.mockReturnValue('android') })

  it.each([true, false])('returns the request acknowledgement without inferring installation (%j)', async requested => {
    native.requestPin.mockResolvedValue({ requested })
    await expect(requestNativeWidgetPin()).resolves.toEqual({ requested })
    expect(native.requestPin).toHaveBeenCalledTimes(1)
    expect(native.getState).not.toHaveBeenCalled()
    expect(native.configure).not.toHaveBeenCalled()
    expect(native.clear).not.toHaveBeenCalled()
  })

  it('does not propagate an installation claim from a pin acknowledgement', async () => {
    native.requestPin.mockResolvedValue({ requested: true, installed: true })
    await expect(requestNativeWidgetPin()).resolves.toEqual({ requested: true })
    expect(native.getState).not.toHaveBeenCalled()
  })

  it.each([
    null, undefined, {}, { requested: 'true' }, { requested: 1 }, { installed: true },
  ])('rejects a malformed pin acknowledgement (%j)', async result => {
    native.requestPin.mockResolvedValue(result)
    await expect(requestNativeWidgetPin()).rejects.toThrow('Demande d’ajout non confirmée')
    expect(native.getState).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'ios', isNative: true, plugin: true },
    { platform: 'web', isNative: false, plugin: true },
    { platform: 'android', isNative: false, plugin: true },
    { platform: 'android', isNative: true, plugin: false },
    { platform: 'desktop', isNative: true, plugin: true },
  ])('avoids native requests in an unsupported environment (%j)', async ({ platform, isNative, plugin }) => {
    native.getPlatform.mockReturnValue(platform)
    native.isNativePlatform.mockReturnValue(isNative)
    native.isPluginAvailable.mockReturnValue(plugin)
    await expect(requestNativeWidgetPin()).resolves.toEqual({ requested: false })
    expect(native.requestPin).not.toHaveBeenCalled()
    expect(native.getState).not.toHaveBeenCalled()
  })

  it('preserves a native request failure without presenting success', async () => {
    const failure = new Error('Demande refusée par le lanceur.')
    native.requestPin.mockRejectedValue(failure)
    await expect(requestNativeWidgetPin()).rejects.toBe(failure)
    expect(native.getState).not.toHaveBeenCalled()
  })

  it('bounds an unresponsive pin request without claiming that it was cancelled', async () => {
    vi.useFakeTimers()
    native.requestPin.mockReturnValue(new Promise(() => undefined))
    const result = expect(requestNativeWidgetPin()).rejects.toThrow('État non confirmé')
    await vi.advanceTimersByTimeAsync(10_000)
    await result
    expect(native.requestPin).toHaveBeenCalledTimes(1)
    expect(native.getState).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
