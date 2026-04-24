'use client'

// MUKTI — Mode 16 Énergie de Remplacement : sélecteur canal + session.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pause, Play, Check } from 'lucide-react'
import { ENERGY_REPLACEMENT_CHANNELS, type EnergyChannel } from '@/lib/constants'

export default function EnergyChannelSelector() {
  const [selected, setSelected] = useState<EnergyChannel | null>(null)
  const [running, setRunning] = useState(false)
  const [urgeBefore, setUrgeBefore] = useState(5)
  const [pending, startTransition] = useTransition()

  const meta = selected ? ENERGY_REPLACEMENT_CHANNELS.find(c => c.id === selected) : null

  function pick(id: EnergyChannel) {
    setSelected(id)
    setRunning(false)
  }

  function start() {
    if (!meta) return
    setRunning(true)
  }

  function complete() {
    if (!meta) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/energy-replacement/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: meta.id,
            duration_sec: meta.duration_sec,
            completed: true,
            urge_before: urgeBefore,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Session non enregistrée.')
          return
        }
        toast.success('Session enregistrée. Belle énergie reçue.')
        setRunning(false)
        setSelected(null)
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  if (running && meta) {
    return (
      <div
        data-testid="energy-session-running"
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, ${meta.color}22 0%, transparent 55%)`,
        }}
      >
        <div className="mb-4 text-center">
          <span className="text-5xl">{meta.emoji}</span>
        </div>
        <h3 className="text-center text-2xl font-light uppercase tracking-[0.2em] text-white">
          {meta.name}
        </h3>
        <p className="mt-3 text-center text-sm text-white/70">{meta.tagline_fr}</p>
        <div className="mt-6 text-center text-xs uppercase tracking-widest text-white/50">
          Fréquence {meta.hz} Hz · {Math.floor(meta.duration_sec / 60)} min
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 hover:bg-white/[0.08]"
          >
            <Pause className="h-4 w-4" />
            Arrêter
          </button>
          <button
            type="button"
            onClick={complete}
            disabled={pending}
            data-testid="energy-complete-btn"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Terminer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="energy-channels-grid"
      >
        {ENERGY_REPLACEMENT_CHANNELS.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => pick(c.id)}
            data-testid={`energy-channel-${c.id}`}
            className={`group relative flex flex-col gap-2 overflow-hidden rounded-3xl border p-5 text-left transition-all ${
              selected === c.id
                ? 'border-[#7c3aed] bg-[#7c3aed]/10'
                : 'border-white/10 bg-white/[0.03] hover:border-white/25'
            }`}
            style={{
              background:
                selected === c.id
                  ? `linear-gradient(135deg, ${c.color}22 0%, transparent 55%)`
                  : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/45">
                {c.hz} Hz
              </span>
            </div>
            <h3 className="text-lg font-medium text-white">{c.name}</h3>
            <p className="text-xs text-white/60">{c.tagline_fr}</p>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-white/40">
              {Math.floor(c.duration_sec / 60)} min
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Ton envie actuelle : {urgeBefore}/10
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={urgeBefore}
            onChange={e => setUrgeBefore(Number(e.target.value))}
            className="mt-2 w-full accent-[#7c3aed]"
          />
          <button
            type="button"
            onClick={start}
            data-testid="energy-start-btn"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white"
          >
            <Play className="h-4 w-4" />
            Démarrer
          </button>
        </div>
      )}
    </div>
  )
}
