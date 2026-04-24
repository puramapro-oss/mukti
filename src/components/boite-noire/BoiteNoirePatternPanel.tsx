'use client'

// MUKTI — G5.8 BoiteNoirePatternPanel
// CTA "Révéler le schéma" → POST /api/boite-noire/detect (Claude Haiku batch).
// Cooldown UI 1h local (localStorage). Affiche 5 agrégats + narratif FR.

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Sparkles, MapPin, Users, Heart, ShieldCheck, Clock } from 'lucide-react'
import { BOITE_NOIRE_LOCATIONS, BOITE_NOIRE_WHO } from '@/lib/constants'
import type { PatternInsight } from '@/lib/boite-noire'

interface Props {
  addictionId: string
  entriesCount: number
}

const COOLDOWN_MS = 60 * 60 * 1000 // 1h
const STORAGE_PREFIX = 'mukti:boite-noire:detect:'

function locationLabel(id: string | null): string | null {
  if (!id) return null
  const f = BOITE_NOIRE_LOCATIONS.find(l => l.id === id)
  return f ? `${f.emoji} ${f.name}` : null
}

function whoLabel(id: string | null): string | null {
  if (!id) return null
  const f = BOITE_NOIRE_WHO.find(w => w.id === id)
  return f ? `${f.emoji} ${f.name}` : null
}

export default function BoiteNoirePatternPanel({ addictionId, entriesCount }: Props) {
  const [insight, setInsight] = useState<PatternInsight | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + addictionId)
      const v = raw ? Number(raw) : 0
      if (v && v > Date.now()) setCooldownUntil(v)
    } catch {
      // ignore
    }
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [addictionId])

  const cooldownActive = cooldownUntil > now
  const cooldownRemainingMin = Math.ceil((cooldownUntil - now) / 60_000)
  const canDetect = entriesCount >= 5 && !cooldownActive && !isPending

  async function handleDetect() {
    if (!canDetect) return
    startTransition(async () => {
      setError(null)
      try {
        const resp = await fetch('/api/boite-noire/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addiction_id: addictionId }),
        })
        if (!resp.ok) {
          const { error: errMsg } = await resp.json().catch(() => ({ error: null }))
          setError(errMsg ?? 'Impossible de révéler — réessaie.')
          return
        }
        const data = (await resp.json()) as { insight: PatternInsight }
        setInsight(data.insight)
        const until = Date.now() + COOLDOWN_MS
        setCooldownUntil(until)
        try {
          localStorage.setItem(STORAGE_PREFIX + addictionId, String(until))
        } catch {
          // ignore
        }
        toast.success('Schéma révélé.', { duration: 2500 })
      } catch {
        setError('Connexion perdue — réessaie.')
      }
    })
  }

  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6"
      data-testid="boite-noire-pattern-panel"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
        <Sparkles className="h-3.5 w-3.5 text-[#A855F7]" />
        <span>Révéler le schéma</span>
      </div>
      <p className="mt-2 text-sm text-white/60">
        Claude analyse tes {entriesCount >= 5 ? 'derniers déclencheurs' : `${entriesCount} entrée${entriesCount > 1 ? 's' : ''}`} et te montre ton pattern.
        Sans jugement, sans prescription.
      </p>

      {entriesCount < 5 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65">
          Il te faut au moins <strong className="text-white">5 entrées</strong> pour révéler un schéma. Tu en as{' '}
          <strong className="text-white">{entriesCount}</strong>. Continue de capturer — chaque entrée t&apos;aide.
        </div>
      )}

      {entriesCount >= 5 && !insight && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={!canDetect}
          data-testid="boite-noire-detect"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#A855F7]/50 bg-gradient-to-r from-[#7C3AED]/30 to-[#A855F7]/30 px-6 py-3 text-sm font-medium text-white shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all hover:from-[#7C3AED]/50 hover:to-[#A855F7]/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4 text-[#DDD6FE]" />
          {isPending
            ? 'Analyse en cours…'
            : cooldownActive
              ? `Revient dans ${cooldownRemainingMin} min`
              : 'Révéler mon schéma'}
        </button>
      )}

      {error && (
        <p className="mt-4 text-sm text-rose-300/80" role="alert">
          {error}
        </p>
      )}

      {insight && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <InsightRow
              icon={<Clock className="h-4 w-4 text-[#A855F7]" />}
              label="Créneau"
              value={insight.top_hour_window ?? '—'}
            />
            <InsightRow
              icon={<MapPin className="h-4 w-4 text-[#A855F7]" />}
              label="Lieu"
              value={locationLabel(insight.top_location) ?? '—'}
            />
            <InsightRow
              icon={<Users className="h-4 w-4 text-[#A855F7]" />}
              label="Contexte"
              value={whoLabel(insight.top_who) ?? '—'}
            />
            <InsightRow
              icon={<Heart className="h-4 w-4 text-[#A855F7]" />}
              label="Émotion"
              value={insight.top_emotion ?? '—'}
            />
            <InsightRow
              icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
              label="Taux de résistance"
              value={`${Math.round(insight.resist_rate * 100)}%`}
            />
            <InsightRow
              icon={<Sparkles className="h-4 w-4 text-white/40" />}
              label="Entrées analysées"
              value={String(insight.total_entries)}
            />
          </div>

          <blockquote
            className="rounded-2xl border border-[#A855F7]/25 bg-[#7C3AED]/[0.08] p-4 font-serif text-base italic leading-relaxed text-[#E9D5FF] sm:text-lg"
            data-testid="boite-noire-narrative"
          >
            « {insight.narrative_fr} »
          </blockquote>

          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-white/35">
            <span>
              Revient dans {cooldownRemainingMin > 0 ? `${cooldownRemainingMin} min` : 'un instant'} pour un nouvel angle.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function InsightRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  )
}
