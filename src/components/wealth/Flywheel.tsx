'use client'

import { motion } from 'framer-motion'
import { Sparkles, Share2, Heart, Users, Award } from 'lucide-react'

const STEPS = [
  { icon: Sparkles, label: 'Libère-toi', color: '#7C3AED' },
  { icon: Share2, label: 'Partage', color: '#06B6D4' },
  { icon: Heart, label: 'Redistribue', color: '#F59E0B' },
  { icon: Users, label: 'Communauté', color: '#10B981' },
  { icon: Award, label: 'Légende', color: '#F472B6' },
]

export default function Flywheel() {
  return (
    <section data-testid="flywheel" className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
      <h3 className="text-xl font-semibold mb-2">Le flywheel MUKTI</h3>
      <p className="text-white/60 text-sm mb-6">
        Chaque action nourrit la suivante. Ensemble, on transforme durablement.
      </p>
      <div className="flex items-center justify-between flex-wrap gap-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex flex-col items-center text-center flex-1 min-w-[80px]"
            >
              <div
                className="relative h-14 w-14 rounded-full flex items-center justify-center mb-2"
                style={{
                  backgroundColor: `${s.color}22`,
                  border: `1px solid ${s.color}55`,
                }}
              >
                <Icon className="h-6 w-6" style={{ color: s.color }} />
              </div>
              <div className="text-sm font-medium text-white/80">{s.label}</div>
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute mt-7 ml-20 text-white/30">→</div>
              )}
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
