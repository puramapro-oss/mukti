'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

interface CountryAggregate {
  country_code: string
  count: number
  total_value_cents: number
}

interface Props {
  aggregates: CountryAggregate[]
}

// Centroïdes approximatifs des pays (lng, lat) — fallback si token Mapbox absent.
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  FR: [2.35, 46.6], US: [-98, 39], GB: [-2, 54], DE: [10.4, 51.2],
  ES: [-3.7, 40.4], IT: [12.5, 41.9], PT: [-8, 39.5], CA: [-106, 56],
  BE: [4.35, 50.85], CH: [8.23, 46.8], NL: [5.3, 52.1], SE: [18, 63],
  JP: [138, 36], CN: [105, 35], AU: [133, -25], BR: [-53, -10],
  IN: [79, 20], MX: [-102, 23], RU: [105, 60], ZA: [25, -29],
}

export function MapboxWorldImpact({ aggregates }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'fallback' | 'error'>('idle')
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!t || t === 'TO_FILL' || t.startsWith('pk.PLACEHOLDER')) {
      setStatus('fallback')
      return
    }
    setToken(t)
    setStatus('loading')
  }, [])

  useEffect(() => {
    if (status !== 'loading' || !token || !containerRef.current) return
    let destroyed = false
    let map: unknown = null
    const container = containerRef.current
    ;(async () => {
      try {
        const mapboxgl = await import('mapbox-gl').then(m => m.default ?? m)
        if (destroyed) return
        ;(mapboxgl as { accessToken: string }).accessToken = token
        const MapCtor = (mapboxgl as unknown as { Map: new (o: Record<string, unknown>) => unknown }).Map
        map = new MapCtor({
          container,
          style: 'mapbox://styles/mapbox/dark-v11',
          projection: 'globe',
          center: [0, 20],
          zoom: 1.2,
          attributionControl: true,
        })
        const MarkerCtor = (mapboxgl as unknown as { Marker: new (o: Record<string, unknown>) => { setLngLat: (c: [number, number]) => { addTo: (m: unknown) => unknown } } }).Marker
        for (const agg of aggregates) {
          const centroid = COUNTRY_CENTROIDS[agg.country_code]
          if (!centroid) continue
          const el = document.createElement('div')
          el.className = 'pointer-events-auto'
          const size = Math.max(10, Math.min(40, 10 + Math.log10(agg.count + 1) * 8))
          el.style.width = `${size}px`
          el.style.height = `${size}px`
          el.style.borderRadius = '9999px'
          el.style.background = 'radial-gradient(closest-side, rgba(236,72,153,0.9), rgba(124,58,237,0.4), transparent)'
          el.style.boxShadow = '0 0 18px rgba(236,72,153,0.6)'
          el.title = `${agg.country_code} — ${agg.count} actions`
          new MarkerCtor({ element: el }).setLngLat(centroid).addTo(map)
        }
        setStatus('loaded')
      } catch {
        if (!destroyed) setStatus('error')
      }
    })()
    return () => {
      destroyed = true
      if (map && typeof (map as { remove?: () => void }).remove === 'function') {
        ;(map as { remove: () => void }).remove()
      }
    }
  }, [status, token, aggregates])

  if (status === 'fallback') {
    return (
      <div
        data-testid="mapbox-fallback"
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-white">Carte du monde — configuration en attente</h3>
            <p className="mt-1 text-xs text-white/60">
              Le token Mapbox (NEXT_PUBLIC_MAPBOX_TOKEN) sera configuré. En attendant, voici
              la répartition par pays :
            </p>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {aggregates.length === 0 ? (
            <li className="col-span-full text-sm text-white/50">Aucune activité enregistrée pour le moment.</li>
          ) : (
            aggregates
              .slice()
              .sort((a, b) => b.count - a.count)
              .slice(0, 12)
              .map(a => (
                <li
                  key={a.country_code}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-widest text-white/40">{a.country_code}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{a.count}</p>
                  <p className="text-[11px] text-white/50">action{a.count > 1 ? 's' : ''}</p>
                </li>
              ))
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl">
      <div
        ref={containerRef}
        className="h-[520px] w-full"
        role="img"
        aria-label="Carte mondiale de l'impact MUKTI"
        data-testid="mapbox-container"
      />
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-white/50">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Chargement du globe…
        </div>
      )}
      {status === 'error' && (
        <p role="alert" className="py-3 text-center text-xs text-red-300">
          La carte n'a pas pu charger. Ton impact reste le même.
        </p>
      )}
    </div>
  )
}
