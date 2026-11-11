'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { wellbeingRequest } from '@/lib/wellbeing-request'
import { parseWidgetPayload, validWidgetItem, widgetTextKey, WIDGET_MAX_ITEMS, type WidgetCadence, type WidgetItem } from '@/lib/affirmation-widget'
import { clearNativeWidget, readNativeWidget, saveNativeWidget, widgetPlatform, type NativeWidgetState } from '@/lib/affirmation-widget-native'

export default function useAffirmationWidget() {
  const [native, setNative] = useState<NativeWidgetState>({ supported: false, configured: false })
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web')
  const [cadence, setCadence] = useState<WidgetCadence>('daily')
  const [selected, setSelected] = useState<WidgetItem[]>([])
  const [catalogue, setCatalogue] = useState<WidgetItem[]>([])
  const [category, setCategory] = useState('paix')
  const [locale, setLocale] = useState<'fr' | 'en'>('fr')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(false)
  const operation = useRef(false)
  const request = useRef<AbortController | null>(null)

  const loadCatalogue = useCallback(async (nextCategory: string, nextLocale: 'fr' | 'en', selectDefault = false) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setCatalogue([])
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
      if (selectDefault) setSelected(previous => previous.length ? previous : items.slice(0, 7))
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Catalogue indisponible.')
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    let disposed = false
    const initialize = async () => {
      let restored = false
      try {
        const state = await readNativeWidget()
        if (disposed) return
        setNative(state)
        setPlatform(widgetPlatform())
        if (state.configured && state.payload) {
          const saved = parseWidgetPayload(state.payload)
          setCadence(saved.cadence); setSelected(saved.items); restored = true
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : 'État du téléphone indisponible.')
      }
      if (!disposed) {
        setReady(true)
        await loadCatalogue('paix', 'fr', !restored)
      }
    }
    void initialize()
    return () => { disposed = true; mounted.current = false; request.current?.abort() }
  }, [loadCatalogue])

  const toggle = (item: WidgetItem) => {
    if (operation.current) return
    setNotice(''); setError('')
    setSelected(previous => {
      const sameText = previous.find(value => widgetTextKey(value.text) === widgetTextKey(item.text))
      if (sameText) return previous.filter(value => value.id !== sameText.id)
      const existing = previous.find(value => value.id === item.id)
      if (existing) return previous.map(value => value.id === item.id ? item : value)
      return previous.length < WIDGET_MAX_ITEMS ? [...previous, item] : previous
    })
  }
  const save = async () => {
    if (operation.current || !native.supported || selected.length === 0) return
    operation.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const state = await saveNativeWidget({ schemaVersion: 1, cadence, items: selected, configuredAt: new Date().toISOString() })
      if (mounted.current) { setNative(state); setNotice('Sélection enregistrée sur ce téléphone. Tu peux ajouter le widget.') }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Enregistrement non confirmé.')
    } finally { operation.current = false; if (mounted.current) setBusy(false) }
  }
  const clear = async () => {
    if (operation.current || !native.supported) return
    operation.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const state = await clearNativeWidget()
      if (mounted.current) { setNative(state); setNotice('Sélection retirée du téléphone. Le widget revient à son écran d’accueil.') }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Suppression non confirmée.')
    } finally { operation.current = false; if (mounted.current) setBusy(false) }
  }
  const explore = (nextCategory: string, nextLocale: 'fr' | 'en') => {
    if (operation.current) return
    setCategory(nextCategory); setLocale(nextLocale); setError(''); setNotice('')
    void loadCatalogue(nextCategory, nextLocale)
  }
  return { native, platform, cadence, selected, catalogue, category, locale, loading, ready, busy, error, notice,
    toggle, save, clear, explore, retry: () => { setError(''); void loadCatalogue(category, locale, selected.length === 0) },
    setCadence: (next: WidgetCadence) => { if (!operation.current) { setCadence(next); setNotice('') } },
  }
}
