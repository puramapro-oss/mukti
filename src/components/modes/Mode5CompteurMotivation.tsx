'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, Clock, Heart, Sparkles } from 'lucide-react'
import ModeFrame from './ModeFrame'
import { type ModeId, type AddictionId } from '@/lib/constants'

const MODE_ID: ModeId = 'compteur'

// Estimations prudentes (moyennes FR 2026) pour projection motivation
// PAS médical : "temps gagné" = libération cognitive moyenne constatée
const COST_PER_DAY_CENTS: Record<AddictionId, number> = {
  tabac: 1200, // paquet ~12€
  alcool: 800,
  sucre: 300,
  drogue: 1500,
  ecran: 0,
  jeux: 1500,
  reseaux_sociaux: 0,
  pornographie: 0,
  achats: 2000,
  nourriture: 400,
  codependance: 0,
  travail: 0,
  autre: 500,
}

const TIME_SAVED_MIN_PER_DAY: Record<AddictionId, number> = {
  tabac: 30,
  alcool: 20,
  sucre: 10,
  drogue: 45,
  ecran: 120,
  jeux: 60,
  reseaux_sociaux: 90,
  pornographie: 30,
  achats: 15,
  nourriture: 10,
  codependance: 30,
  travail: 45,
  autre: 20,
}

interface Props {
  addictionId: string
  type: AddictionId
  currentDays: number
  bestDays: number
}

export default function Mode5CompteurMotivation({ addictionId, type, currentDays, bestDays }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId}>
      {({ onCompleted }) => (
        <CompteurView type={type} currentDays={currentDays} bestDays={bestDays} onCompleted={onCompleted} />
      )}
    </ModeFrame>
  )
}

function CompteurView({
  type,
  currentDays,
  bestDays,
  onCompleted,
}: {
  type: AddictionId
  currentDays: number
  bestDays: number
  onCompleted: (outcome?: 'completed') => void
}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200)
    return () => clearTimeout(t)
  }, [])

  const moneyCents = currentDays * COST_PER_DAY_CENTS[type]
  const timeMinutes = currentDays * TIME_SAVED_MIN_PER_DAY[type]
  const timeHours = timeMinutes / 60
  const healthScore = Math.min(100, Math.round((currentDays / 90) * 100))

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--cyan)]">Compteur motivation</p>
        <h2 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
          Ce que tu as déjà regagné
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {currentDays} jour{currentDays > 1 ? 's' : ''} de libération — estimations prudentes.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Argent non dépensé"
          value={show ? (moneyCents / 100).toFixed(2).replace('.', ',') : '0,00'}
          unit="€"
          color="var(--gold,#F59E0B)"
          disabled={COST_PER_DAY_CENTS[type] === 0}
          disabledMsg="Pas d'impact financier direct pour ce type."
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Temps récupéré"
          value={show ? (timeHours >= 1 ? timeHours.toFixed(1).replace('.', ',') : timeMinutes.toString()) : '0'}
          unit={timeHours >= 1 ? 'h' : 'min'}
          color="var(--cyan,#06B6D4)"
        />
        <StatCard
          icon={<Heart className="h-5 w-5" />}
          label="Vitalité estimée"
          value={show ? healthScore.toString() : '0'}
          unit="%"
          color="var(--accent,#10B981)"
          hint="Indice d'apaisement (non médical)"
        />
      </div>

      <div className="flex w-full flex-col gap-3 rounded-3xl border border-[var(--purple)]/20 bg-gradient-to-br from-[var(--purple)]/10 to-[var(--cyan)]/10 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--purple,#c4a9ff)]">
          <Sparkles className="h-4 w-4" /> Ta meilleure série
        </p>
        <p className="text-2xl font-semibold text-[var(--text-primary)]">
          {bestDays} jour{bestDays > 1 ? 's' : ''} sans {type === 'autre' ? 'cette habitude' : ''}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {currentDays > bestDays
            ? 'Tu bats ton propre record en ce moment même. 🔥'
            : currentDays === bestDays && currentDays > 0
              ? 'Tu égales ton meilleur. Le prochain jour sera historique.'
              : bestDays > 0
                ? 'Chaque jour te rapproche de ton record.'
                : 'Aujourd\'hui commence ton histoire.'}
        </p>
      </div>

      {currentDays >= 1 && <ConfettiBurst />}

      <button
        type="button"
        onClick={() => onCompleted('completed')}
        className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        data-testid="compteur-done"
      >
        Continuer ma journée
      </button>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  unit,
  color,
  disabled,
  disabledMsg,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  color: string
  disabled?: boolean
  disabledMsg?: string
  hint?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white/5 p-5"
    >
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <p className="text-xs uppercase tracking-widest">{label}</p>
      </div>
      {disabled ? (
        <p className="text-sm text-[var(--text-muted)]">{disabledMsg}</p>
      ) : (
        <div className="flex items-baseline gap-1">
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-semibold"
            style={{ color }}
          >
            {value}
          </motion.span>
          <span className="text-sm text-[var(--text-muted)]">{unit}</span>
        </div>
      )}
      {hint && !disabled && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </motion.div>
  )
}

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * 2 * Math.PI
        const distance = 200 + Math.random() * 200
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: 0,
              rotate: 360 * (i % 2 === 0 ? 1 : -1),
            }}
            transition={{ duration: 2.5, delay: i * 0.02, ease: 'easeOut' }}
            className="absolute h-2 w-2 rounded-sm"
            style={{
              background: i % 3 === 0 ? '#06B6D4' : i % 3 === 1 ? '#7C3AED' : '#F59E0B',
            }}
          />
        )
      })}
    </div>
  )
}
