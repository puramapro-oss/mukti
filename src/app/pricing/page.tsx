'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PLANS } from '@/lib/constants'

export default function PricingPage() {
  const { user } = useAuth()
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('yearly')
  const [loading, setLoading] = useState(false)

  async function subscribe() {
    if (!user) {
      window.location.href = '/signup?next=/pricing'
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      if (data.url) window.location.href = data.url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur paiement'
      toast.error(msg)
      setLoading(false)
    }
  }

  const premium = PLANS.premium
  const monthlyPrice = premium.price_monthly / 100
  const yearlyPrice = premium.price_yearly / 100
  const yearlyEqMonthly = yearlyPrice / 12

  return (
    <div className="min-h-screen pt-32 pb-20" data-testid="pricing-page">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Link href="/" className="text-sm text-[var(--cyan)] hover:underline">← Retour</Link>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--text-primary)] sm:text-6xl">
            Un seul plan. <span className="gradient-text">Tout débloqué.</span>
          </h1>
          <p className="mt-4 text-base text-[var(--text-secondary)]">
            14 jours d&apos;essai gratuit. Sans engagement. Tu vois ton montant récupérable avant même de payer.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-full border border-[var(--border)] bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                interval === 'monthly' ? 'bg-white text-black' : 'text-[var(--text-secondary)]'
              }`}
              data-testid="interval-monthly"
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                interval === 'yearly' ? 'bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] text-white' : 'text-[var(--text-secondary)]'
              }`}
              data-testid="interval-yearly"
            >
              Annuel <span className="ml-1 text-xs">-30%</span>
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="glass rounded-3xl border border-[var(--border)] p-8">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">Découverte</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Pour découvrir ce que tu peux récupérer</p>
            <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--text-primary)]">
              0 €
            </p>
            <p className="text-xs text-[var(--text-muted)]">À vie</p>
            <ul className="mt-6 space-y-2">
              {PLANS.free.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-6 block rounded-xl border border-[var(--border)] bg-white/5 px-5 py-3 text-center text-sm font-medium text-[var(--text-primary)] hover:bg-white/10"
            >
              Commencer gratuitement
            </Link>
          </div>

          {/* Premium */}
          <div className="glass relative rounded-3xl border-2 border-[var(--cyan)] p-8 shadow-2xl shadow-[var(--cyan)]/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-3 py-1 text-xs font-bold text-white">
              ⭐ POPULAIRE
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">{premium.label}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Récupère tout, lance les démarches en 1 clic</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--text-primary)]">
                {(interval === 'monthly' ? monthlyPrice : yearlyEqMonthly).toFixed(2).replace('.', ',')} €
              </span>
              <span className="text-sm text-[var(--text-muted)]">/ mois</span>
            </div>
            {interval === 'yearly' && (
              <p className="text-xs text-[var(--text-muted)]">
                <span className="line-through">{monthlyPrice.toFixed(2).replace('.', ',')} €/mois</span>
                <span className="ml-2 font-semibold text-emerald-400">{yearlyPrice.toFixed(2).replace('.', ',')} €/an</span>
              </p>
            )}
            <ul className="mt-6 space-y-2">
              {premium.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={subscribe}
              disabled={loading}
              data-testid="pricing-subscribe"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? 'Redirection…' : 'Démarrer mes 14 jours gratuits'}
            </button>
            <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
              Sans engagement. Annulable en 1 clic.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
