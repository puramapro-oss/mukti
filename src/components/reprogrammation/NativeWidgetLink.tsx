'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { AFFIRMATION_WIDGET_PATH, isAffirmationWidgetLink } from '@/lib/affirmation-widget'

/** The widget only opens a fixed first-party route. Auth remains in the normal middleware. */
export default function NativeWidgetLink() {
  const router = useRouter()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    let lastNavigation = 0
    const open = ({ url }: { url: string }) => {
      if (disposed || !isAffirmationWidgetLink(url)) return
      // getLaunchUrl and appUrlOpen may report the same launch together.
      if (Date.now() - lastNavigation < 1000) return
      lastNavigation = Date.now()
      router.push(AFFIRMATION_WIDGET_PATH)
    }
    // Optional bridge failure does not block startup; the same route remains in the hub.
    const listener = App.addListener('appUrlOpen', open).catch(() => null)
    void App.getLaunchUrl().then(launch => { if (launch) open(launch) }).catch(() => undefined)
    return () => {
      disposed = true
      void listener.then(handle => handle?.remove()).catch(() => undefined)
    }
  }, [router])
  return null
}
