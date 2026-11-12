import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { NativeWidgetState } from '../../src/lib/affirmation-widget-native'

const deps = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), clear: vi.fn(), listen: vi.fn() }))
vi.mock('@capacitor/app', () => ({ App: { addListener: deps.listen } }))
vi.mock('../../src/lib/wellbeing-request', () => ({ wellbeingRequest: async () => ({ items: [] }) }))
vi.mock('../../src/lib/affirmation-widget-native', () => ({
  readNativeWidget: deps.read, saveNativeWidget: deps.save, clearNativeWidget: deps.clear,
  widgetPlatform: () => 'ios', requestNativeWidgetPin: async () => ({ requested: false }),
}))
import useAffirmationWidget from '../../src/hooks/useAffirmationWidget'

const first = { id: '00000000-0000-4000-8000-000000000001', text: 'Je prends mon temps.' }
const second = { id: '00000000-0000-4000-8000-000000000002', text: 'Je reviens à moi.' }
const saved: NativeWidgetState = { supported: true, configured: true, payload: JSON.stringify({
  schemaVersion: 1, cadence: 'moments', items: [first], configuredAt: '2026-11-11T07:00:00.000Z',
}) }

beforeEach(() => {
  vi.resetAllMocks()
  deps.read.mockResolvedValue(saved)
  deps.listen.mockResolvedValue({ remove: vi.fn() })
})

it('removes late native listeners in StrictMode and ignores foreground events after unmount', async () => {
  const registrations: {
    notify: (state: { isActive: boolean }) => void
    resolve: (handle: { remove: () => void }) => void
  }[] = []
  deps.listen.mockImplementation((_event, notify) => new Promise(resolve => { registrations.push({ notify, resolve }) }))
  // React 19 replays initial effects only when StrictMode wraps the root.
  const view = renderHook(() => useAffirmationWidget(), { reactStrictMode: true })
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  expect(deps.listen).toHaveBeenCalledTimes(2)
  expect(deps.listen.mock.calls.every(call => call[0] === 'appStateChange')).toBe(true)
  const staleRemove = vi.fn()
  const activeRemove = vi.fn()
  await act(async () => {
    registrations[0].resolve({ remove: staleRemove })
    registrations[1].resolve({ remove: activeRemove })
  })
  expect(staleRemove).toHaveBeenCalledOnce()
  expect(activeRemove).not.toHaveBeenCalled()
  view.unmount()
  await waitFor(() => expect(activeRemove).toHaveBeenCalledOnce())
  const reads = deps.read.mock.calls.length
  registrations.forEach(registration => registration.notify({ isActive: true }))
  expect(deps.read).toHaveBeenCalledTimes(reads)
})

it('refreshes confirmed phone state on foreground without replacing the draft or allowing overlapping writes', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.toggle(second))
  let confirm!: (state: NativeWidgetState) => void
  deps.read.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
  const notify = deps.listen.mock.calls[0][1] as (state: { isActive: boolean }) => void
  act(() => notify({ isActive: false }))
  expect(deps.read).toHaveBeenCalledTimes(1)
  act(() => notify({ isActive: true }))
  expect(deps.read).toHaveBeenCalledTimes(2)
  expect(result.current.refreshingNative).toBe(true)
  act(() => {
    void result.current.save()
    void result.current.clear()
    result.current.restoreSaved()
    result.current.toggle(first)
  })
  expect(deps.save).not.toHaveBeenCalled()
  expect(deps.clear).not.toHaveBeenCalled()
  expect(result.current.selected).toEqual([first, second])
  await act(async () => { confirm({ supported: true, configured: false, installed: true }) })
  expect(result.current.refreshingNative).toBe(false)
  expect(result.current.native.installed).toBe(true)
  expect(result.current.hasSavedSelection).toBe(false)
  expect(result.current.selected).toEqual([first, second])
  expect(result.current.dirty).toBe(true)
})

it('warns before unloading an edited native draft and removes the guard after restore or unmount', async () => {
  const view = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  const prevented = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(prevented()).toBe(false)
  act(() => view.result.current.toggle(second))
  expect(prevented()).toBe(true)
  act(() => view.result.current.restoreSaved())
  expect(prevented()).toBe(false)
  act(() => view.result.current.toggle(second))
  view.unmount()
  expect(prevented()).toBe(false)
})

it('defers a foreground check during a native write and verifies the phone once the write settles', async () => {
  const { result } = renderHook(() => useAffirmationWidget())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.toggle(second))
  let finish!: (state: NativeWidgetState) => void
  deps.save.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  act(() => { void result.current.save() })
  const notify = deps.listen.mock.calls[0][1] as (state: { isActive: boolean }) => void
  act(() => notify({ isActive: true }))
  expect(deps.read).toHaveBeenCalledTimes(1)
  const confirmed = { supported: true, configured: true, installed: true,
    payload: JSON.stringify(deps.save.mock.calls[0][0]) }
  deps.read.mockResolvedValueOnce(confirmed)
  await act(async () => { finish(confirmed) })
  await waitFor(() => expect(result.current.busy).toBe(false))
  expect(deps.read).toHaveBeenCalledTimes(2)
  expect(result.current.native.installed).toBe(true)
  expect(result.current.dirty).toBe(false)
  expect(result.current.selected).toEqual([first, second])
})
