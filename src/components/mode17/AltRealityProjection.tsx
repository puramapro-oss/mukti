'use client'

// MUKTI — Mode 17 Réalité Alternative : projection future-self via Pollinations.

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Wand2, Sparkles, Loader2 } from 'lucide-react'
import { ALT_REALITY_HORIZONS, type AltRealityHorizon } from '@/lib/constants'

interface AddictionLite {
  id: string
  type: string
}

interface Session {
  id: string
  projection_horizon_days: number
  projection_url: string | null
  projection_prompt: string | null
  created_at: string
}

interface Props {
  addictions: AddictionLite[]
  initialSessions: Session[]
}

export default function AltRealityProjection({ addictions, initialSessions }: Props) {
  const [horizon, setHorizon] = useState<AltRealityHorizon>(30)
  const [addictionId, setAddictionId] = useState<string>(addictions[0]?.id ?? '')
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/alt-reality/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            horizon,
            addiction_id: addictionId || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Projection impossible.')
          return
        }
        setSessions(prev => [json.session, ...prev].slice(0, 10))
        toast.success('Regarde-toi, libéré·e.')
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  const latest = sessions[0]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Horizon
            </label>
            <select
              value={horizon}
              onChange={e => setHorizon(Number(e.target.value) as AltRealityHorizon)}
              data-testid="alt-reality-horizon-select"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7]"
            >
              {ALT_REALITY_HORIZONS.map(h => (
                <option key={h.days} value={h.days} className="bg-[#0A0A0F]">
                  {h.label_fr} — {h.description_fr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Addiction (optionnel)
            </label>
            <select
              value={addictionId}
              onChange={e => setAddictionId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7]"
            >
              <option value="" className="bg-[#0A0A0F]">Multi-addictions / général</option>
              {addictions.map(a => (
                <option key={a.id} value={a.id} className="bg-[#0A0A0F]">
                  {a.type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          data-testid="alt-reality-project-btn"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#a855f7] to-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white shadow-[0_8px_40px_-12px_rgba(168,85,247,0.5)] disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Projection en cours (20-40s)…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Voir mon futur libéré
            </>
          )}
        </button>
      </div>

      {latest && latest.projection_url && (
        <div className="overflow-hidden rounded-3xl border border-[#a855f7]/30 bg-gradient-to-br from-[#a855f7]/10 to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#DDD6FE]">
            <Sparkles className="h-3.5 w-3.5" />
            Ta projection à {latest.projection_horizon_days} jours
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl">
            <Image
              src={latest.projection_url}
              alt="Projection future-self"
              width={512}
              height={768}
              unoptimized
              data-testid="alt-reality-image"
              className="w-full object-cover"
            />
          </div>
          {latest.projection_prompt && (
            <p className="mt-4 text-center text-sm italic text-white/70">
              &laquo; {latest.projection_prompt} &raquo;
            </p>
          )}
        </div>
      )}

      {sessions.length > 1 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Tes projections précédentes
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {sessions.slice(1).map(s => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-white/10">
                {s.projection_url && (
                  <Image
                    src={s.projection_url}
                    alt={`Projection J+${s.projection_horizon_days}`}
                    width={256}
                    height={384}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                )}
                <div className="px-2 py-1 text-[10px] text-white/55">
                  J+{s.projection_horizon_days}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
