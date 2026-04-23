'use client'

import { useEffect, useState } from 'react'
import { Wallet, ArrowDownToLine, History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { formatEurosFraction, formatPoints } from '@/lib/utils'
import { WALLET_MIN_WITHDRAWAL } from '@/lib/constants'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ShareStoryButton from '@/components/shared/ShareStoryButton'
import type { WalletTransaction } from '@/types'

export default function WalletPage() {
  const { profile, refetch } = useAuth()
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [iban, setIban] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile) return
    setIban(profile.iban ?? '')
    const sb = createClient()
    sb.from('wallet_transactions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setTransactions((data ?? []) as WalletTransaction[])
        setLoading(false)
      })
  }, [profile])

  async function withdraw() {
    const num = Number(amount)
    if (!num || num < WALLET_MIN_WITHDRAWAL) {
      toast.error(`Minimum ${WALLET_MIN_WITHDRAWAL} €.`)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: num, iban }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur retrait')
      toast.success('Retrait demandé ! Traitement sous 2-5 jours.')
      setAmount('')
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Retrait impossible'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="wallet-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Wallet</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Tes gains, points et retraits IBAN.</p>
        </div>
        <ShareStoryButton
          type="gains"
          headline="Récupère ce qui te revient"
          value={`+${formatEurosFraction(Number(profile.wallet_balance ?? 0))}`}
          sub="récupérés via MUKTI"
        />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cyan)]/20 to-[var(--cyan)]/5">
              <Wallet className="h-6 w-6 text-[var(--cyan)]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Solde €</p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
                {formatEurosFraction(Number(profile.wallet_balance ?? 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--purple)]/20 to-[var(--purple)]/5">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Points PURAMA</p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
                {formatPoints(profile.purama_points ?? 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Retrait */}
      <Card className="p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
          <ArrowDownToLine className="h-5 w-5 text-[var(--cyan)]" /> Retirer mes gains
        </h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">Minimum {WALLET_MIN_WITHDRAWAL} €. Délai 2-5 jours ouvrés.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant en €"
            data-testid="withdraw-amount"
          />
          <Input
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="IBAN (FR76...)"
            data-testid="withdraw-iban"
          />
        </div>
        <Button onClick={withdraw} disabled={submitting} className="mt-4 w-full sm:w-auto" data-testid="withdraw-submit">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
          Demander le retrait
        </Button>
      </Card>

      {/* Historique */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
          <History className="h-5 w-5 text-[var(--cyan)]" /> Historique
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Chargement…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Pas encore de transactions.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{tx.description ?? tx.type}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`shrink-0 font-semibold ${Number(tx.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Number(tx.amount) >= 0 ? '+' : ''}
                  {formatEurosFraction(Number(tx.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
