import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { WidgetPayload } from '../../src/lib/affirmation-widget'

const deps = vi.hoisted(() => ({ request: vi.fn(), read: vi.fn(), save: vi.fn(), clear: vi.fn() }))
vi.mock('../../src/lib/wellbeing-request', () => ({ wellbeingRequest: deps.request }))
vi.mock('../../src/lib/affirmation-widget-native', () => ({
  readNativeWidget: deps.read, saveNativeWidget: deps.save, clearNativeWidget: deps.clear, widgetPlatform: () => 'ios',
}))
import useAffirmationWidget from '../../src/hooks/useAffirmationWidget'

const first = { id: '00000000-0000-4000-8000-000000000001', text: 'Je prends mon temps.' }
const second = { id: '00000000-0000-4000-8000-000000000002', text: 'Je reviens à moi.' }
const translated = { ...first, text: 'I take my time.' }
const stored: WidgetPayload = { schemaVersion: 1, cadence: 'moments', items: [first], configuredAt: '2026-11-11T07:00:00.000Z' }

beforeEach(() => {
  vi.clearAllMocks()
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
  expect(result.current.error).toBe('Enregistrement non confirmé.')
  expect(result.current.notice).toBe('')
  expect(result.current.native.configured).toBe(false)
  await act(async () => { await result.current.clear() })
  expect(result.current.error).toBe('Suppression non confirmée.')
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
