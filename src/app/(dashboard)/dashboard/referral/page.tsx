'use client'

import { useState } from 'react'
import { Copy, Share2, Check, Users, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useReferral } from '@/hooks/useReferral'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { copyToClipboard, formatEurosFraction } from '@/lib/utils'
import { REFERRAL } from '@/lib/constants'

export default function ReferralPage() {
  const { profile } = useAuth()
  const { referralLink, referralCode, referralCount } = useReferral()
  const [copied, setCopied] = useState(false)

  if (!profile) return null

  async function copy() {
    const ok = await copyToClipboard(referralLink)
    if (ok) {
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Récupère ton argent oublié avec MUKTI',
        text: `J'ai trouvé toutes mes aides en 2 min avec MUKTI. Tu peux essayer avec mon code (-50% le 1er mois) :`,
        url: referralLink,
      })
    } else {
      copy()
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="referral-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Parrainage</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {REFERRAL.referrer_first_percent}% du 1er paiement + {REFERRAL.referrer_lifetime_percent}% à vie sur chaque filleul.
        </p>
      </header>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-[var(--cyan)]" />
            <p className="text-3xl font-bold text-[var(--text-primary)]">{referralCount}</p>
            <p className="text-xs text-[var(--text-muted)]">Filleuls inscrits</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4 text-center">
            <Gift className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
            <p className="text-3xl font-bold text-[var(--text-primary)]">{formatEurosFraction(Number(profile.wallet_balance ?? 0))}</p>
            <p className="text-xs text-[var(--text-muted)]">Wallet (gains parrainage inclus)</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Ton lien personnel</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 font-mono text-sm text-[var(--text-primary)]">
            {referralLink || `purama.dev/go/${referralCode || '...'}`}
          </div>
          <Button onClick={copy} variant="secondary" data-testid="referral-copy">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
          <Button onClick={share} data-testid="referral-share">
            <Share2 className="h-4 w-4" />
            Partager
          </Button>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Ton ami bénéficie de -{REFERRAL.referred_first_month_discount}% le 1er mois. Tu touches{' '}
          {REFERRAL.referrer_first_percent}% du 1er paiement + {REFERRAL.referrer_lifetime_percent}% à vie.
        </p>
      </Card>
    </div>
  )
}
