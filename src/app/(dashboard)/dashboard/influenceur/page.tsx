'use client'

import { Megaphone, Sparkles, TrendingUp, Coins } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import Card from '@/components/ui/Card'
import { INFLUENCER, APP_DOMAIN } from '@/lib/constants'

export default function InfluenceurPage() {
  const { profile } = useAuth()
  if (!profile) return null

  const link = profile.referral_code ? `https://${APP_DOMAIN}/go/${profile.referral_code}` : ''

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="influenceur-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
          Programme influenceur
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Rejoins la team créateurs MUKTI. Commission {INFLUENCER.commission_first}% premier paiement +{' '}
          {INFLUENCER.commission_recurring}% à vie.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <Sparkles className="mb-2 h-6 w-6 text-[var(--cyan)]" />
          <p className="text-sm text-[var(--text-secondary)]">Lien personnalisé -50% pour ton audience pendant {INFLUENCER.promo_validity_days} jours</p>
        </Card>
        <Card className="p-5">
          <TrendingUp className="mb-2 h-6 w-6 text-emerald-400" />
          <p className="text-sm text-[var(--text-secondary)]">Dashboard temps réel : clics, conversions, gains.</p>
        </Card>
        <Card className="p-5">
          <Coins className="mb-2 h-6 w-6 text-amber-400" />
          <p className="text-sm text-[var(--text-secondary)]">{INFLUENCER.commission_first}% premier paiement + {INFLUENCER.commission_recurring}% à vie. Retrait IBAN dès 5€.</p>
        </Card>
        <Card className="p-5">
          <Megaphone className="mb-2 h-6 w-6 text-[var(--purple)]" />
          <p className="text-sm text-[var(--text-secondary)]">Kit créateur : visuels, scripts, statistiques officielles.</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Ton lien actuel</h2>
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 font-mono text-sm text-[var(--text-primary)]">
          {link || 'Active ton parrainage pour générer ton lien.'}
        </div>
        <Link
          href="/dashboard/referral"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Aller au parrainage
        </Link>
      </Card>
    </div>
  )
}
