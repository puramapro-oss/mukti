'use client'

// MUKTI — Mode 18 Récompenses Mystères : coffre quotidien avec animation ouverture.

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface Reward {
  id: string
  tier: 'common' | 'rare' | 'legendary' | 'jackpot'
  reward_type: 'points' | 'coupon' | 'booster' | 'coin' | 'xp' | 'nothing'
  reward_amount: number
  streak_day: number
  claim_date: string
}

interface Props {
  initialToday: Reward | null
  initialHistory: Reward[]
}

const TIER_STYLE: Record<Reward['tier'], { label: string; gradient: string; color: string }> = {
  common: { label: 'Commun', gradient: 'from-slate-500 to-slate-700', color: '#94a3b8' },
  rare: { label: 'Rare', gradient: 'from-[#06b6d4] to-[#3b82f6]', color: '#06b6d4' },
  legendary: { label: 'Légendaire', gradient: 'from-[#a855f7] to-[#ec4899]', color: '#a855f7' },
  jackpot: { label: 'JACKPOT', gradient: 'from-[#F59E0B] to-[#ec4899]', color: '#F59E0B' },
}

const TYPE_LABEL: Record<Reward['reward_type'], string> = {
  points: 'Points MUKTI',
  coupon: 'Coupon réduction',
  booster: 'Booster',
  coin: 'Coin rare',
  xp: 'XP',
  nothing: 'À demain…',
}

export default function MysteryChest({ initialToday, initialHistory }: Props) {
  const [reward, setReward] = useState<Reward | null>(initialToday)
  const [revealing, setRevealing] = useState(false)
  const [history, setHistory] = useState<Reward[]>(initialHistory)
  const [pending, startTransition] = useTransition()

  function claim() {
    if (reward) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/mystery-rewards/claim-daily', { method: 'POST' })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Coffre indisponible.')
          return
        }
        setRevealing(true)
        setTimeout(() => {
          setReward(json.reward as Reward)
          setHistory(prev => [json.reward as Reward, ...prev].slice(0, 14))
          setRevealing(false)
        }, 2400)
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div
        data-testid="mystery-chest-card"
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl"
      >
        <AnimatePresence mode="wait">
          {!reward && !revealing && (
            <motion.button
              key="closed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              onClick={claim}
              disabled={pending}
              data-testid="mystery-chest-claim"
              className="mx-auto flex w-full max-w-xs flex-col items-center gap-4 disabled:opacity-60"
            >
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-[#F59E0B] to-[#ec4899] shadow-[0_20px_80px_-20px_rgba(245,158,11,0.6)]"
              >
                <Gift className="h-20 w-20 text-white" />
              </motion.div>
              <div className="text-center">
                <div className="text-base font-medium text-white">Ton coffre du jour</div>
                <div className="text-xs text-white/55">Clique pour ouvrir</div>
              </div>
            </motion.button>
          )}

          {revealing && (
            <motion.div
              key="revealing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
              data-testid="mystery-chest-revealing"
            >
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 2.4, ease: 'easeInOut' }}
                className="flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-[#F59E0B] to-[#ec4899] shadow-[0_20px_100px_-10px_rgba(245,158,11,0.8)]"
              >
                <Loader2 className="h-20 w-20 animate-spin text-white" />
              </motion.div>
              <div className="text-sm uppercase tracking-widest text-white/60">
                Révélation en cours…
              </div>
            </motion.div>
          )}

          {reward && !revealing && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-4"
              data-testid="mystery-chest-revealed"
            >
              <div
                className={`flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br ${TIER_STYLE[reward.tier].gradient} shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)]`}
              >
                {reward.reward_type === 'nothing' ? (
                  <Sparkles className="h-20 w-20 text-white/80" />
                ) : (
                  <div className="text-center text-white">
                    <div className="text-5xl font-light">{reward.reward_amount}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest opacity-80">
                      {TYPE_LABEL[reward.reward_type]}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div
                  className="inline-block rounded-full border px-3 py-0.5 text-[10px] uppercase tracking-widest"
                  style={{
                    borderColor: `${TIER_STYLE[reward.tier].color}55`,
                    color: TIER_STYLE[reward.tier].color,
                  }}
                >
                  {TIER_STYLE[reward.tier].label}
                </div>
                <div className="mt-2 text-sm text-white/70">
                  Jour {reward.streak_day} de streak
                </div>
              </div>
              <div className="text-xs text-white/50">Reviens demain pour ton prochain coffre.</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {history.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Historique 14 derniers jours
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {history.map(r => (
              <div
                key={r.id}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-center ${
                  r.reward_type === 'nothing'
                    ? 'border-white/10 bg-white/[0.02]'
                    : 'border-[#7c3aed]/30 bg-[#7c3aed]/5'
                }`}
                title={`${r.claim_date} — ${r.reward_type} ${r.reward_amount}`}
              >
                <div className="text-xs font-medium text-white">
                  {r.reward_type === 'nothing' ? '—' : r.reward_amount}
                </div>
                <div
                  className="mt-0.5 h-1 w-1 rounded-full"
                  style={{ background: TIER_STYLE[r.tier].color }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
