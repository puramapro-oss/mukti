'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function ConfirmationPage() {
  useEffect(() => {
    // Simple confetti via emoji burst
    const root = document.getElementById('confetti-root')
    if (!root) return
    for (let i = 0; i < 30; i++) {
      const el = document.createElement('span')
      el.textContent = ['✨', '💎', '🌟', '🎉'][i % 4] ?? '✨'
      el.style.position = 'fixed'
      el.style.left = `${Math.random() * 100}%`
      el.style.top = '-20px'
      el.style.fontSize = `${16 + Math.random() * 12}px`
      el.style.transition = `transform ${2 + Math.random() * 2}s linear, opacity 2s`
      el.style.pointerEvents = 'none'
      el.style.zIndex = '50'
      root.appendChild(el)
      requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 720}deg)`
        setTimeout(() => { el.style.opacity = '0' }, 1500)
      })
      setTimeout(() => el.remove(), 4000)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center px-6">
      <div id="confetti-root" />
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
          <Sparkles className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Bienvenue dans MUKTI.</h1>
        <p className="text-xl text-white/70 mb-8">
          Ton aventure commence. Tu viens de rejoindre une communauté qui transforme sa vie, ensemble.
        </p>
        <Link
          href="/dashboard"
          data-testid="confirmation-cta"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 px-8 py-4 text-lg font-semibold transition-all"
        >
          Ouvrir mon espace
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </main>
  )
}
