'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { wellbeingRequest } from '@/lib/wellbeing-request'
import { parseWidgetPayload, validWidgetItem, widgetTextKey, WIDGET_MAX_ITEMS, type WidgetCadence, type WidgetItem, type WidgetPayload } from '@/lib/affirmation-widget'
import { clearNativeWidget, readNativeWidget, requestNativeWidgetPin, saveNativeWidget, widgetPlatform, type NativeWidgetState } from '@/lib/affirmation-widget-native'

type NativeResult = { state?: NativeWidgetState; notice?: string }

export default function useAffirmationWidget() {
  const [native, setNative] = useState<NativeWidgetState>({ supported: false, configured: false })
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web')
  const [saved, setSaved] = useState<WidgetPayload | null>(null)
  const [cadence, setCadence] = useState<WidgetCadence>('daily')
  const [selected, setSelected] = useState<WidgetItem[]>([])
  const [catalogue, setCatalogue] = useState<WidgetItem[]>([])
  const [category, setCategory] = useState('paix')
  const [locale, setLocale] = useState<'fr' | 'en'>('fr')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refreshingNative, setRefreshingNative] = useState(false)
  const [error, setError] = useState('')
  const [nativeError, setNativeError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(false)
  const readyRef = useRef(false)
  const operation = useRef(false)
  const edited = useRef(false)
  const initialRestore = useRef(true)
  const pendingNativeRefresh = useRef(false)
  const refreshAction = useRef<() => Promise<void>>(async () => undefined)
  const request = useRef<AbortController | null>(null)

  const hasSavedSelection = saved !== null
  const dirty = saved ? cadence !== saved.cadence || selected.length !== saved.items.length
    || selected.some((item, index) => item.id.toLowerCase() !== saved.items[index]?.id.toLowerCase()
      || item.text !== saved.items[index]?.text) : selected.length > 0
  const canPin = ready && platform === 'android' && native.supported && native.configured
    && hasSavedSelection && !dirty && !busy && !nativeError && !native.installed

  const loadCatalogue = useCallback(async (nextCategory: string, nextLocale: 'fr' | 'en', selectDefault = false) => {
    if (!mounted.current) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError(''); setCatalogue([])
    try {
      const result = await wellbeingRequest<{ items: unknown }>(
        `/api/affirmations/widget?category=${encodeURIComponent(nextCategory)}&locale=${nextLocale}`, {}, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      if (!Array.isArray(result.items) || result.items.length > WIDGET_MAX_ITEMS || !result.items.every(validWidgetItem)) {
        throw new Error('Le catalogue reçu est illisible. Réessaie.')
      }
      const items = result.items as WidgetItem[]
      if (new Set(items.map(item => item.id.toLowerCase())).size !== items.length) throw new Error('Le catalogue contient des doublons. Réessaie.')
      setCatalogue(items)
      if (selectDefault) setSelected(previous => edited.current || previous.length ? previous : items.slice(0, 7))
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Catalogue indisponible.')
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false)
    }
  }, [])

  const acceptNativeState = useCallback((state: NativeWidgetState) => {
    const snapshot = state.configured && state.payload ? parseWidgetPayload(state.payload) : null
    setNative(state); setSaved(snapshot)
    // A delayed first successful read may restore the cache only before any
    // deliberate edit. Subsequent reads update the baseline, never the draft.
    if (initialRestore.current) {
      initialRestore.current = false
      if (!edited.current && snapshot) { setCadence(snapshot.cadence); setSelected(snapshot.items) }
    }
    return snapshot
  }, [])

  const runNative = useCallback(async (task: () => Promise<NativeResult>, fallback: string, refreshing = false) => {
    if (!mounted.current || !readyRef.current || operation.current) return
    operation.current = true
    setBusy(true); setRefreshingNative(refreshing); setNativeError(''); setNotice('')
    try {
      const result = await task()
      if (mounted.current) {
        if (result.state) acceptNativeState(result.state)
        if (result.notice) setNotice(result.notice)
      }
    } catch (failure) {
      if (mounted.current) setNativeError(failure instanceof Error ? failure.message : fallback)
    } finally {
      operation.current = false
      if (mounted.current) {
        setBusy(false); setRefreshingNative(false)
        if (pendingNativeRefresh.current) {
          pendingNativeRefresh.current = false
          void refreshAction.current()
        }
      }
    }
  }, [acceptNativeState])

  const refreshNative = useCallback(() => runNative(
    async () => ({ state: await readNativeWidget() }), 'État du téléphone indisponible.', true,
  ), [runNative])

  useEffect(() => { refreshAction.current = refreshNative }, [refreshNative])

  useEffect(() => {
    mounted.current = true
    setPlatform(widgetPlatform())
    setRefreshingNative(true)
    let disposed = false
    const initialize = async () => {
      let restored = false
      try {
        const state = await readNativeWidget()
        if (disposed) return
        restored = acceptNativeState(state) !== null
      } catch (failure) {
        if (!disposed) setNativeError(failure instanceof Error ? failure.message : 'État du téléphone indisponible.')
      }
      if (!disposed) {
        readyRef.current = true
        setReady(true); setRefreshingNative(false)
        await loadCatalogue('paix', 'fr', !restored)
      }
    }
    void initialize()
    return () => {
      disposed = true; mounted.current = false; readyRef.current = false
      pendingNativeRefresh.current = false; request.current?.abort()
    }
  }, [acceptNativeState, loadCatalogue])

  useEffect(() => {
    if (widgetPlatform() === 'web') return
    let disposed = false
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (disposed || !isActive || !readyRef.current) return
      if (operation.current) pendingNativeRefresh.current = true
      else void refreshNative()
    }).catch(() => null)
    return () => {
      disposed = true
      void listener.then(handle => handle?.remove()).catch(() => undefined)
    }
  }, [refreshNative])

  useEffect(() => {
    if (platform === 'web' || !dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, platform])

  const toggle = (item: WidgetItem) => {
    if (operation.current || !mounted.current) return
    edited.current = true; setNotice('')
    setSelected(previous => {
      const sameText = previous.find(value => widgetTextKey(value.text) === widgetTextKey(item.text))
      if (sameText) return previous.filter(value => value.id !== sameText.id)
      const existing = previous.find(value => value.id === item.id)
      if (existing) return previous.map(value => value.id === item.id ? item : value)
      return previous.length < WIDGET_MAX_ITEMS ? [...previous, item] : previous
    })
  }
  const save = async () => {
    if (!native.supported || !selected.length || !dirty) return
    await runNative(async () => ({
      state: await saveNativeWidget({ schemaVersion: 1, cadence, items: selected, configuredAt: new Date().toISOString() }),
      notice: 'Sélection enregistrée sur ce téléphone. Tu peux ajouter le widget.',
    }), 'Enregistrement non confirmé.')
  }
  const clear = async () => {
    if (!native.supported) return
    await runNative(async () => ({
      state: await clearNativeWidget(),
      notice: 'Sélection retirée du téléphone. Le widget revient à son écran d’accueil.',
    }), 'Suppression non confirmée.')
  }
  const pin = async () => {
    if (!canPin) return
    await runNative(async () => {
      const result = await requestNativeWidgetPin()
      return { notice: result.requested
        ? 'Demande envoyée au téléphone. Confirme l’ajout dans la fenêtre du système.'
        : 'L’ajout direct est indisponible. Ajoute MUKTI depuis les widgets de ton écran d’accueil.' }
    }, 'Demande d’ajout non confirmée.')
  }
  const restoreSaved = () => {
    if (operation.current || !mounted.current || !saved) return
    edited.current = true; setCadence(saved.cadence); setSelected(saved.items); setNotice('')
  }
  const explore = (nextCategory: string, nextLocale: 'fr' | 'en') => {
    if (operation.current || !mounted.current) return
    setCategory(nextCategory); setLocale(nextLocale); setNotice('')
    void loadCatalogue(nextCategory, nextLocale)
  }
  return { native, platform, cadence, selected, catalogue, category, locale, loading, ready, busy, error, notice,
    nativeError, refreshingNative, hasSavedSelection, dirty, canPin, refreshNative, restoreSaved, pin,
    toggle, save, clear, explore,
    retry: () => { if (!operation.current) void loadCatalogue(category, locale) },
    setCadence: (next: WidgetCadence) => {
      if (!operation.current && mounted.current) { edited.current = true; setCadence(next); setNotice('') }
    },
  }
}
