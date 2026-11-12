import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { WidgetPayload } from '../../src/lib/affirmation-widget'

const deps = vi.hoisted(() => ({
  request: vi.fn(), read: vi.fn(), save: vi.fn(), clear: vi.fn(), platform: vi.fn(), pin: vi.fn(), listen: vi.fn(),
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: deps.listen } }))
vi.mock('../../src/lib/wellbeing-request', () => ({ wellbeingRequest: deps.request }))
vi.mock('../../src/lib/affirmation-widget-native', () => ({
  readNativeWidget: deps.read, saveNativeWidget: deps.save, clearNativeWidget: deps.clear,
  widgetPlatform: deps.platform, requestNativeWidgetPin: deps.pin,
}))
import useAffirmationWidget from '../../src/hooks/useAffirmationWidget'

const first = { id: '00000000-0000-4000-8000-000000000001', text: 'Je prends mon temps.' }
const second = { id: '00000000-0000-4000-8000-000000000002', text: 'Je reviens à moi.' }
const translated = { ...first, text: 'I take my time.' }
const stored: WidgetPayload = { schemaVersion: 1, cadence: 'moments', items: [first], configuredAt: '2026-11-11T07:00:00.000Z' }

beforeEach(() => {
  vi.resetAllMocks()
  deps.platform.mockReturnValue('ios')
  deps.listen.mockResolvedValue({ remove: vi.fn() })
  deps.pin.mockResolvedValue({ requested: true })
  deps.read.mockResolvedValue({ supported: true, configured: false })
  deps.request.mockResolvedValue({ items: [first, second] })
  deps.save.mockImplementation(async (payload: WidgetPayload) => ({ supported: true, configured: true, payload: JSON.stringify(payload) }))
  deps.clear.mockResolvedValue({ supported: true, configured: false })
})

it('preserves a native snapshot and its cadence when the catalogue is offline', async () => {
  deps.read.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  deps.request.mockRejectedValue(new Error('Connexion interrompue. Lecture indisponible.'))
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.selected).toEqual([first])
  expect(result.current.cadence).toBe('moments')
  expect(result.current.native.configured).toBe(true)
  expect(result.current.error).toContain('Lecture indisponible')
  expect(deps.save).not.toHaveBeenCalled()
})

it('replaces a selected translation with the same ID without duplicating or silently retaining its old text', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.toggle(translated))
  expect(result.current.selected).toEqual([translated, second])
  await act(async () => { await result.current.save() })
  expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ items: [translated, second] }))
  act(() => result.current.toggle(translated))
  expect(result.current.selected).toEqual([second])
})

it('treats an equivalent phrase from another category as the existing selection instead of creating a duplicate', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  const equivalent = { id: '00000000-0000-4000-8000-000000000003', text: 'JE PRENDS MON TEMPS.' }
  act(() => result.current.toggle(equivalent))
  expect(result.current.selected).toEqual([second])
  act(() => result.current.toggle(equivalent))
  expect(result.current.selected).toEqual([second, equivalent])
})

it('allows only one native write and freezes the snapshot during rapid repeated actions', async () => {
  let finish!: (value: { supported: boolean; configured: boolean; payload: string }) => void
  deps.save.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => {
    void result.current.save()
    void result.current.save()
    result.current.toggle(first)
    result.current.setCadence('moments')
    void result.current.clear()
  })
  expect(deps.save).toHaveBeenCalledTimes(1)
  expect(deps.clear).not.toHaveBeenCalled()
  expect(result.current.busy).toBe(true)
  expect(result.current.selected).toEqual([first, second])
  expect(result.current.cadence).toBe('daily')
  await act(async () => { finish({ supported: true, configured: true, payload: JSON.stringify(deps.save.mock.calls[0][0]) }) })
  expect(result.current.busy).toBe(false)
  expect(result.current.native.configured).toBe(true)
  expect(result.current.notice).toContain('enregistrée')
})

it('never shows a success notice after a native write or deletion fails', async () => {
  deps.save.mockRejectedValue(new Error('Enregistrement non confirmé.'))
  deps.clear.mockRejectedValue(new Error('Suppression non confirmée.'))
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.save() })
  expect(result.current.nativeError).toBe('Enregistrement non confirmé.')
  expect(result.current.error).toBe('')
  expect(result.current.notice).toBe('')
  expect(result.current.native.configured).toBe(false)
  await act(async () => { await result.current.clear() })
  expect(result.current.nativeError).toBe('Suppression non confirmée.')
  expect(result.current.notice).toBe('')
  expect(result.current.busy).toBe(false)
})

it('ignores a superseded catalogue response even when the transport ignores cancellation', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  let oldResponse!: (value: { items: typeof first[] }) => void
  deps.request.mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve }))
    .mockResolvedValueOnce({ items: [translated] })
  act(() => result.current.explore('confiance', 'fr'))
  const previousSignal = deps.request.mock.calls.at(-1)![2] as AbortSignal
  act(() => result.current.explore('paix', 'en'))
  await waitFor(() => expect(result.current.catalogue).toEqual([translated]))
  expect(previousSignal.aborted).toBe(true)
  await act(async () => { oldResponse({ items: [second] }) })
  expect(result.current.catalogue).toEqual([translated])
  expect(result.current.locale).toBe('en')
  expect(result.current.loading).toBe(false)
})

it('aborts the active catalogue read on unmount without starting a native write', async () => {
  deps.request.mockReturnValue(new Promise(() => undefined))
  const view = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(deps.request).toHaveBeenCalledOnce())
  const signal = deps.request.mock.calls[0][2] as AbortSignal
  expect(signal.aborted).toBe(false)
  view.unmount()
  expect(signal.aborted).toBe(true)
  expect(deps.save).not.toHaveBeenCalled()
  expect(deps.clear).not.toHaveBeenCalled()
})

it('recovers the native connection without losing an edited draft or hiding its error on a catalogue retry', async () => {
  deps.read.mockRejectedValueOnce(new Error('Le téléphone ne répond pas.'))
    .mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.platform).toBe('ios')
  expect(result.current.nativeError).toContain('Le téléphone ne répond pas')
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.nativeError).toContain('Le téléphone ne répond pas')
  expect(deps.read).toHaveBeenCalledTimes(1)
  act(() => { result.current.toggle(first); result.current.setCadence('daily') })
  await act(async () => { await result.current.refreshNative() })
  expect(deps.read).toHaveBeenCalledTimes(2)
  expect(result.current.native.supported).toBe(true)
  expect(result.current.nativeError).toBe('')
  expect(result.current.selected).toEqual([second])
  expect(result.current.cadence).toBe('daily')
  expect(result.current.hasSavedSelection).toBe(true)
  expect(result.current.dirty).toBe(true)
  expect(deps.save).not.toHaveBeenCalled()
})

it('imports an initially unreadable saved selection after recovery only while the draft remains untouched', async () => {
  deps.read.mockRejectedValueOnce(new Error('Lecture temporairement indisponible.'))
    .mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.refreshNative() })
  expect(result.current.selected).toEqual([first])
  expect(result.current.cadence).toBe('moments')
  expect(result.current.dirty).toBe(false)
  expect(deps.save).not.toHaveBeenCalled()
})

it('does not choose phrases again when refreshing a deliberately empty selection', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => { result.current.toggle(first); result.current.toggle(second) })
  expect(result.current.selected).toEqual([])
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.catalogue).toEqual([first, second])
  expect(result.current.selected).toEqual([])
  expect(deps.save).not.toHaveBeenCalled()
})

it('keeps a selection empty when the initial catalogue arrives after native recovery and a deliberate removal', async () => {
  let respond!: (value: { items: typeof first[] }) => void
  deps.request.mockReturnValue(new Promise(resolve => { respond = resolve }))
  deps.read.mockRejectedValueOnce(new Error('Lecture temporairement indisponible.'))
    .mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.loading).toBe(true)
  await act(async () => { await result.current.refreshNative() })
  expect(result.current.selected).toEqual([first])
  act(() => result.current.toggle(first))
  expect(result.current.selected).toEqual([])
  await act(async () => { respond({ items: [first, second] }) })
  expect(result.current.loading).toBe(false)
  expect(result.current.catalogue).toEqual([first, second])
  expect(result.current.selected).toEqual([])
  expect(result.current.dirty).toBe(true)
})

it('tracks the last confirmed snapshot across edits, local restore, save and clear without rewriting an identical selection', async () => {
  deps.read.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.hasSavedSelection).toBe(true)
  expect(result.current.dirty).toBe(false)
  await act(async () => { await result.current.save() })
  expect(deps.save).not.toHaveBeenCalled()
  act(() => { result.current.toggle(second); result.current.setCadence('daily') })
  expect(result.current.dirty).toBe(true)
  act(() => result.current.restoreSaved())
  expect(result.current.selected).toEqual([first])
  expect(result.current.cadence).toBe('moments')
  expect(result.current.dirty).toBe(false)
  expect(deps.save).not.toHaveBeenCalled()
  act(() => result.current.toggle(second))
  await act(async () => { await result.current.save() })
  expect(result.current.dirty).toBe(false)
  expect(deps.save).toHaveBeenCalledTimes(1)
  act(() => result.current.setCadence('daily'))
  expect(result.current.dirty).toBe(true)
  act(() => result.current.restoreSaved())
  expect(result.current.selected).toEqual([first, second])
  expect(result.current.cadence).toBe('moments')
  await act(async () => { await result.current.clear() })
  expect(result.current.native.configured).toBe(false)
  expect(result.current.hasSavedSelection).toBe(false)
  expect(result.current.selected).toEqual([first, second])
  expect(result.current.dirty).toBe(true)
  expect(deps.save).toHaveBeenCalledTimes(1)
})

it('keeps the confirmed snapshot available when clearing the phone fails', async () => {
  deps.read.mockResolvedValue({ supported: true, configured: true, payload: JSON.stringify(stored) })
  deps.clear.mockRejectedValue(new Error('Suppression non confirmée.'))
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.clear() })
  expect(result.current.nativeError).toBe('Suppression non confirmée.')
  expect(result.current.hasSavedSelection).toBe(true)
  expect(result.current.dirty).toBe(false)
  expect(result.current.selected).toEqual([first])
  expect(result.current.notice).toBe('')
})

it('requests Android placement only for a saved selection and never reports that a request proves installation', async () => {
  deps.platform.mockReturnValue('android')
  deps.read.mockResolvedValue({ supported: true, configured: true, installed: false, payload: JSON.stringify(stored) })
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.canPin).toBe(true)
  await act(async () => { await result.current.pin() })
  expect(deps.pin).toHaveBeenCalledTimes(1)
  expect(result.current.notice).toContain('Demande envoyée')
  expect(result.current.native.installed).toBe(false)
  expect(deps.save).not.toHaveBeenCalled()
  act(() => result.current.toggle(second))
  expect(result.current.canPin).toBe(false)
  await act(async () => { await result.current.pin() })
  expect(deps.pin).toHaveBeenCalledTimes(1)
})
