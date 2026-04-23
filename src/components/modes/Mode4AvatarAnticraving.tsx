'use client'

import { motion } from 'framer-motion'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'

const MODE_ID: ModeId = 'avatar'

const STAGES = [
  { id: 0, name: 'Graine', emoji: '🌰', threshold: 0, message: 'Tu es une graine. Tout commence par ce moment.' },
  { id: 1, name: 'Pousse', emoji: '🌱', threshold: 1, message: 'Une pousse traverse la terre. Tu as traversé 24h.' },
  { id: 2, name: 'Arbre', emoji: '🌳', threshold: 7, message: 'Un arbre prend racine. Tu es stable, tu tiens.' },
  { id: 3, name: 'Fleur', emoji: '🌸', threshold: 30, message: 'La fleur s\'ouvre. Tu rayonnes. Tu te retrouves.' },
  { id: 4, name: 'Lumière', emoji: '✨', threshold: 90, message: 'Tu es lumière. Tu inspires ceux qui te croisent.' },
]

interface Props {
  addictionId: string
  currentDays: number
}

export default function Mode4AvatarAnticraving({ addictionId, currentDays }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId}>
      {({ onCompleted }) => <AvatarView currentDays={currentDays} onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function AvatarView({
  currentDays,
  onCompleted,
}: {
  currentDays: number
  onCompleted: (outcome?: 'resisted' | 'completed') => void
}) {
  const stageIdx = STAGES.reduce((acc, s, i) => (currentDays >= s.threshold ? i : acc), 0)
  const currentStage = STAGES[stageIdx]
  const nextStage = STAGES[stageIdx + 1]
  const daysToNext = nextStage ? nextStage.threshold - currentDays : null
  const progressToNext = nextStage
    ? Math.min(100, ((currentDays - currentStage.threshold) / (nextStage.threshold - currentStage.threshold)) * 100)
    : 100

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Particules autour */}
      <div className="relative flex h-64 w-64 items-center justify-center">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, Math.cos((i * Math.PI) / 4) * 100, 0],
              y: [0, Math.sin((i * Math.PI) / 4) * 100, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
            className="absolute h-2 w-2 rounded-full bg-[var(--cyan)]"
            style={{ filter: 'blur(1px)' }}
          />
        ))}

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
          className="relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)]/20 to-[var(--purple)]/20 text-8xl"
          style={{ boxShadow: '0 0 80px rgba(124,58,237,0.5)' }}
        >
          {currentStage.emoji}
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--cyan)]">Ton avatar de libération</p>
        <h2 className="text-3xl font-semibold text-[var(--text-primary)]">{currentStage.name}</h2>
        <p className="max-w-md text-lg text-[var(--text-secondary)]">« {currentStage.message} »</p>
      </div>

      {nextStage && daysToNext !== null && (
        <div className="w-full max-w-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Prochain stade : {nextStage.name}</span>
            <span>
              Dans {daysToNext}j <span className="opacity-50">{nextStage.emoji}</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)]"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onCompleted('completed')}
        className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        data-testid="avatar-done"
      >
        Merci, je repars
      </button>
    </div>
  )
}
