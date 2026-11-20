import { beforeEach, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const native = vi.hoisted(() => ({ isNative: vi.fn(), addListener: vi.fn(), launch: vi.fn(), push: vi.fn(), remove: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: native.isNative } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: native.addListener, getLaunchUrl: native.launch } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: native.push }) }))
import NativeWidgetLink from '../../src/components/reprogrammation/NativeWidgetLink'
import { AFFIRMATION_WIDGET_PATH } from '../../src/lib/affirmation-widget'

beforeEach(() => {
  vi.clearAllMocks()
  native.isNative.mockReturnValue(true)
  native.addListener.mockResolvedValue({ remove: native.remove })
  native.remove.mockResolvedValue(undefined)
  native.launch.mockResolvedValue(undefined)
})

it('does not touch native startup or install listeners in a browser', () => {
  native.isNative.mockReturnValue(false)
  render(<NativeWidgetLink />)
  expect(native.addListener).not.toHaveBeenCalled()
  expect(native.launch).not.toHaveBeenCalled()
  expect(native.push).not.toHaveBeenCalled()
})

it('navigates a cold widget launch to the fixed existing route and removes its listener', async () => {
  native.launch.mockResolvedValue({ url: 'mukti://affirmations' })
  const view = render(<NativeWidgetLink />)
  await waitFor(() => expect(native.push).toHaveBeenCalledWith(AFFIRMATION_WIDGET_PATH))
  expect(native.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function))
  view.unmount()
  await waitFor(() => expect(native.remove).toHaveBeenCalledOnce())
})

it('ignores arbitrary warm links and coalesces duplicate launch delivery', async () => {
  render(<NativeWidgetLink />)
  await waitFor(() => expect(native.addListener).toHaveBeenCalledOnce())
  const onOpen = native.addListener.mock.calls[0][1] as (input: { url: string }) => void
  onOpen({ url: 'mukti://affirmations?next=https://attacker.test' })
  onOpen({ url: 'https://attacker.test' })
  expect(native.push).not.toHaveBeenCalled()
  onOpen({ url: 'mukti://affirmations' })
  onOpen({ url: 'mukti://affirmations' })
  expect(native.push).toHaveBeenCalledTimes(1)
  expect(native.push).toHaveBeenLastCalledWith(AFFIRMATION_WIDGET_PATH)
})

it('does not navigate after unmount even when getLaunchUrl resolves late', async () => {
  let resolveLaunch!: (value: { url: string }) => void
  native.launch.mockReturnValue(new Promise(resolve => { resolveLaunch = resolve }))
  const view = render(<NativeWidgetLink />)
  const onOpen = native.addListener.mock.calls[0][1] as (input: { url: string }) => void
  view.unmount()
  resolveLaunch({ url: 'mukti://affirmations' })
  onOpen({ url: 'mukti://affirmations' })
  await Promise.resolve()
  expect(native.push).not.toHaveBeenCalled()
})

it('survives optional cold-launch lookup failure and still handles a warm widget link', async () => {
  native.launch.mockRejectedValue(new Error('native launch unavailable'))
  const view = render(<NativeWidgetLink />)
  await Promise.resolve()
  const onOpen = native.addListener.mock.calls[0][1] as (input: { url: string }) => void
  onOpen({ url: 'mukti://affirmations' })
  expect(native.push).toHaveBeenCalledWith(AFFIRMATION_WIDGET_PATH)
  view.unmount()
})

it('handles listener registration rejection immediately while preserving a valid cold launch', async () => {
  native.addListener.mockRejectedValue(new Error('listener unavailable'))
  native.launch.mockResolvedValue({ url: 'mukti://affirmations' })
  const view = render(<NativeWidgetLink />)
  await waitFor(() => expect(native.push).toHaveBeenCalledWith(AFFIRMATION_WIDGET_PATH))
  view.unmount()
  await Promise.resolve()
  expect(native.remove).not.toHaveBeenCalled()
})
