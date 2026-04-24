'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PLANS_STRIPE, TRIAL_DAYS, type PlanSlug } from '@/lib/constants'

export default function PricingPage() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PlanSlug>('main_annual')
  const [promoCode, setPromoCode] = useState('')
  const [promoValidated, setPromoValidated] = useState<{ label: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function validatePromo() {
    if (!promoCode.trim()) return
    try {
      const res = await fetch('/api/stripe/validate-promo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPromoValidated(null)
        toast.error(data.error ?? 'Code invalide.')
        return
      }
      setPromoValidated({ label: data.label })
      toast.success(`Code ${data.code} appliqué : ${data.label}`)
    } catch {
      toast.error('Impossible de valider le code.')
    }
  }

  async function subscribe() {
    if (!user) {
      window.location.href = `/signup?next=/pricing?plan=${plan}`
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan_slug: plan,
          promo_code: promoValidated ? promoCode.trim().toUpperCase() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      if (data.url) window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur paiement.')
      setLoading(false)
    }
  }

  const monthly = PLANS_STRIPE.main_monthly.price_cents / 100
  const annual = PLANS_STRIPE.main_annual.price_cents / 100
  const annualEqMonth = annual / 12
  const savings = monthly * 12 - annual

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-6xl font-bold mb-4">
            Libère-toi. <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Ensemble.</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {TRIAL_DAYS} jours d&apos;essai gratuit. Sans engagement. Annule en 1 clic.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => setPlan('main_monthly')}
            className={`relative rounded-3xl border p-8 text-left transition-all ${
              plan === 'main_monthly'
                ? 'border-violet-500 bg-white/[0.08] ring-2 ring-violet-500/40'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <div className="text-white/60 text-sm mb-2 uppercase tracking-wider">Mensuel</div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-bold">{monthly.toFixed(2).replace('.', ',')}€</span>
              <span className="text-white/60">/mois</span>
            </div>
            <p className="text-white/70 text-sm">Flexibilité totale — annule quand tu veux.</p>
          </button>

          <button
            onClick={() => setPlan('main_annual')}
            className={`relative rounded-3xl border p-8 text-left transition-all ${
              plan === 'main_annual'
                ? 'border-violet-500 bg-white/[0.08] ring-2 ring-violet-500/40'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <span className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> -33% · POPULAIRE
            </span>
            <div className="text-white/60 text-sm mb-2 uppercase tracking-wider">Annuel</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold">{annualEqMonth.toFixed(2).replace('.', ',')}€</span>
              <span className="text-white/60">/mois</span>
            </div>
            <div className="text-sm text-white/50 line-through mb-2">{monthly.toFixed(2).replace('.', ',')}€/mois</div>
            <p className="text-emerald-400 text-sm font-semibold">Économise {savings.toFixed(0)}€/an</p>
          </button>
        </div>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-3 text-white/70">
            <Tag className="h-4 w-4" />
            <span className="text-sm font-medium">Code promo</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value); setPromoValidated(null) }}
              placeholder="WELCOME10"
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 uppercase"
              maxLength={40}
            />
            <button
              onClick={validatePromo}
              disabled={!promoCode.trim()}
              className="rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 px-6 py-2 font-medium transition-colors"
            >
              Appliquer
            </button>
          </div>
          {promoValidated && <p className="mt-2 text-emerald-400 text-sm">✓ {promoValidated.label}</p>}
        </div>

        <ul className="space-y-3 mb-8 max-w-xl mx-auto">
          {[
            `${TRIAL_DAYS} jours d'essai gratuit`,
            'Libération addictions personnalisée IA',
            'Cercles d\'Intention illimités',
            'Événements C.O.R.E. mondiaux',
            'AR Energy Mirror complet',
            'AURORA OMEGA + Reprogrammation',
            'Wallet retrait IBAN dès 5€',
            'Annulation en 1 clic',
          ].map(f => (
            <li key={f} className="flex items-start gap-3 text-white/80">
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-center">
          <button
            onClick={subscribe}
            disabled={loading}
            data-testid="pricing-subscribe-btn"
            className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 px-12 py-4 text-lg font-semibold disabled:opacity-50 transition-all"
          >
            {loading ? 'Redirection…' : `Commencer · ${TRIAL_DAYS} jours gratuits`}
          </button>
        </div>

        <p className="mt-6 text-center text-white/40 text-xs">
          Pas de carte requise pour l&apos;essai gratuit.{' '}
          <Link href="/cgv" className="underline hover:text-white/60">CGV</Link>
          {' · '}
          <Link href="/politique-confidentialite" className="underline hover:text-white/60">Confidentialité</Link>
        </p>
      </section>
    </main>
  )
}
