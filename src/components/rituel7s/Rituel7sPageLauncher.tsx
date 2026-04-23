'use client'

// MUKTI — G5.6 Bouton "Lancer le rituel" utilisé sur la page /dashboard/rituel-7s.
// Déclenche openRituel('page') via le context global.

import { Zap } from 'lucide-react'
import { useRituel7s } from './Rituel7sProvider'

export default function Rituel7sPageLauncher() {
  const { openRituel } = useRituel7s()
  return (
    <button
      type="button"
      onClick={() => openRituel('page')}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] px-6 py-3 text-sm font-medium text-white shadow-xl shadow-[#F59E0B]/20 transition-transform hover:scale-[1.02]"
      data-testid="rituel7s-page-launch"
    >
      <Zap className="h-4 w-4" strokeWidth={2.2} />
      Lancer le rituel
    </button>
  )
}
