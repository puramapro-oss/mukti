'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, MessageSquare, Wallet, ArrowRight, X, Trophy, Sparkles, Coins,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { APP_SHORT_NAME } from '@/lib/constants'

const STORAGE_INTRO = 'mukti_intro_seen'
const STORAGE_TUTO = 'mukti_tutorial_completed'

interface TutoStep {
  id: string
  emoji: string
  title: string
  body: string
  cta: string
  Icon: typeof Search
}

const STEPS: TutoStep[] = [
  {
    id: 'welcome',
    emoji: '💰',
    title: `Bienvenue dans ${APP_SHORT_NAME}`,
    body: "En 2 minutes, je trouve tout l'argent que tu laisses sur la table. Aides, remboursements, droits oubliés.",
    cta: 'Commencer',
    Icon: Sparkles,
  },
  {
    id: 'scanner',
    emoji: '🔍',
    title: 'Lance ton scanner financier',
    body: "MUKTI analyse ta situation et liste TOUTES les aides auxquelles tu as droit : CAF, CPAM, Pôle Emploi, impôts, MDPH…",
    cta: 'Suivant',
    Icon: Search,
  },
  {
    id: 'chat',
    emoji: '💬',
    title: 'Pose toutes tes questions',
    body: "Question juridique, fiscale, administrative ? MUKTI te répond instantanément avec les bons articles de loi.",
    cta: 'Suivant',
    Icon: MessageSquare,
  },
  {
    id: 'wallet',
    emoji: '💸',
    title: 'Encaisse tes gains',
    body: "Missions rémunérées, parrainage, redistribution mensuelle. Retrait sur ton IBAN dès 5 €.",
    cta: 'Suivant',
    Icon: Wallet,
  },
  {
    id: 'concours',
    emoji: '🏆',
    title: 'Joue aux concours',
    body: "10 gagnants par concours. Tu gagnes des places en utilisant l'app — pas en payant.",
    cta: 'Suivant',
    Icon: Trophy,
  },
  {
    id: 'points',
    emoji: '⭐',
    title: 'Cumule des points PURAMA',
    body: "Convertibles en réductions, abonnement gratuit, ou cash. 1pt = 0,01€.",
    cta: "C'est parti",
    Icon: Coins,
  },
]

export default function OnboardingFlow() {
  const { user, profile, refetch } = useAuth()
  const [phase, setPhase] = useState<'idle' | 'tutorial' | 'done'>('idle')
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (!user || !profile) return
    if (typeof window === 'undefined') return

    const tutoDone = localStorage.getItem(STORAGE_TUTO) === '1' || profile.tutorial_completed
    if (!tutoDone) setPhase('tutorial')
    else setPhase('done')
  }, [user, profile])

  const current = useMemo(() => STEPS[stepIdx], [stepIdx])

  async function finishTutorial() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_INTRO, '1')
      localStorage.setItem(STORAGE_TUTO, '1')
    }
    if (user) {
      const sb = createClient()
      await sb.from('profiles').update({ tutorial_completed: true, onboarded: true }).eq('auth_user_id', user.id)
      refetch()
    }
    setPhase('done')
  }

  function next() {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1)
    else finishTutorial()
  }

  if (phase !== 'tutorial' || !current) return null

  return (
    <AnimatePresence>
      <motion.div
        key="tuto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && finishTutorial()}
      >
        <motion.div
          initial={{ y: 30, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-nebula)] p-8 text-center shadow-2xl"
          data-testid="onboarding-modal"
        >
          <button
            type="button"
            onClick={finishTutorial}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]"
            aria-label="Fermer le tutoriel"
            data-testid="onboarding-skip"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)]/20 to-[var(--purple)]/20 text-5xl">
            {current.emoji}
          </div>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
            {current.title}
          </h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">{current.body}</p>

          <div className="mb-6 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-[var(--cyan)]' : 'w-1.5 bg-white/15'}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
            data-testid="onboarding-next"
          >
            {current.cta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
