'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CreditCard, Calendar, AlertCircle, Download } from 'lucide-react'
import type { MuktiSubscription } from '@/lib/subscriptions'
import { PLANS_STRIPE, ANTI_CHURN_LIFETIME_PRICE_CENTS } from '@/lib/constants'

interface Props { initialSubscription: MuktiSubscription | null }

interface StripeInvoiceRow {
  id: string
  amount_paid: number | null
  currency: string | null
  status: string | null
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  created: number
}

type FlowStep = 'none' | 'pause_offer' | 'anti_churn_offer' | 'confirm'

export default function AbonnementClient({ initialSubscription }: Props) {
  const [sub, setSub] = useState(initialSubscription)
  const [invoices, setInvoices] = useState<StripeInvoiceRow[]>([])
  const [flowStep, setFlowStep] = useState<FlowStep>('none')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions/invoices').then(r => r.json()).then(d => {
      if (Array.isArray(d.invoices)) setInvoices(d.invoices as StripeInvoiceRow[])
    }).catch(() => null)
  }, [])

  async function actCancel(step: Exclude<FlowStep, 'none'>, action: 'accept' | 'decline') {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/cancel-flow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur.')
      if (data.switched_to === 'anti_churn') {
        toast.success('Plan anti-churn activé : 4,99€/mois à vie.')
        setFlowStep('none')
        const r = await fetch('/api/subscriptions/current').then(r => r.json())
        setSub(r.subscription ?? null)
      } else if (data.canceled) {
        toast.success('Annulation enregistrée. Accès jusqu\'à fin de période.')
        setFlowStep('none')
      } else if (data.next) {
        setFlowStep(data.next as FlowStep)
      } else {
        setFlowStep('none')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  if (!sub) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Abonnement</h1>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white/70 mb-6">Tu n&apos;as pas encore d&apos;abonnement actif.</p>
            <Link
              href="/pricing"
              data-testid="abo-cta-pricing"
              className="inline-block rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3 font-semibold"
            >
              Voir les offres
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const planCfg = PLANS_STRIPE[sub.plan_slug]
  const priceEur = (planCfg.price_cents / 100).toFixed(2).replace('.', ',')
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('fr-FR') : '—'
  const isCanceled = sub.status === 'canceled' || !!sub.cancel_at

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Abonnement</h1>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-white/60 text-sm">Plan actif</div>
              <div className="text-2xl font-semibold">{planCfg.label_fr}</div>
              <div className="text-white/60 mt-1">{priceEur}€/{planCfg.interval === 'year' ? 'an' : 'mois'}</div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              sub.status === 'active' ? 'bg-emerald-500/20 text-emerald-400'
                : sub.status === 'trialing' ? 'bg-violet-500/20 text-violet-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {sub.status === 'trialing' ? 'Essai' : sub.status === 'active' ? 'Actif' : sub.status}
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Calendar className="h-4 w-4" />
            {isCanceled ? `Annulé — accès jusqu'au ${periodEnd}` : `Prochain renouvellement : ${periodEnd}`}
          </div>
        </section>

        {!isCanceled && sub.plan_slug !== 'anti_churn' && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold mb-3">Résilier mon abonnement</h2>
            <p className="text-white/70 text-sm mb-4">
              L&apos;annulation prend effet à la fin de la période en cours. Tu gardes l&apos;accès jusqu&apos;au {periodEnd}.
            </p>
            <button
              onClick={() => setFlowStep('pause_offer')}
              data-testid="abo-cancel-start"
              className="rounded-full border border-white/20 hover:bg-white/[0.06] px-6 py-2 text-sm transition-colors"
            >
              Commencer la résiliation
            </button>
          </section>
        )}

        {flowStep === 'pause_offer' && (
          <section className="rounded-3xl border border-amber-500/30 bg-amber-500/[0.04] p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Une pause plutôt qu&apos;un adieu ?</h3>
                <p className="text-white/80">
                  Tu peux suspendre 1 mois gratuitement et revenir quand tu veux. Ton progrès reste intact.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => actCancel('pause_offer', 'accept')} disabled={loading}
                className="rounded-full bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 font-semibold disabled:opacity-50">
                Mettre en pause 1 mois
              </button>
              <button onClick={() => actCancel('pause_offer', 'decline')} disabled={loading}
                className="rounded-full border border-white/20 px-5 py-2 text-sm">
                Continuer la résiliation
              </button>
            </div>
          </section>
        )}

        {flowStep === 'anti_churn_offer' && (
          <section className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] to-cyan-500/[0.06] p-6">
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="h-6 w-6 text-violet-400 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Une offre unique, réservée à toi</h3>
                <p className="text-white/80 mb-3">
                  Garde TOUTES les fonctionnalités MUKTI pour seulement{' '}
                  <span className="text-2xl font-bold text-violet-300">
                    {(ANTI_CHURN_LIFETIME_PRICE_CENTS / 100).toFixed(2).replace('.', ',')}€/mois
                  </span>
                  {' '}— <strong>à vie</strong>.
                </p>
                <p className="text-emerald-400 text-sm">50% de réduction permanente. Ne se reverra jamais.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => actCancel('anti_churn_offer', 'accept')} disabled={loading}
                data-testid="abo-anti-churn-accept"
                className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 px-6 py-2 font-semibold disabled:opacity-50">
                Accepter 4,99€/mois à vie
              </button>
              <button onClick={() => actCancel('anti_churn_offer', 'decline')} disabled={loading}
                className="rounded-full border border-white/20 px-5 py-2 text-sm">
                Non, annuler quand même
              </button>
            </div>
          </section>
        )}

        {flowStep === 'confirm' && (
          <section className="rounded-3xl border border-red-500/30 bg-red-500/[0.04] p-6">
            <h3 className="text-xl font-semibold mb-3">Confirmation finale</h3>
            <p className="text-white/70 mb-4">
              Tu es sûr·e ? Tu perdras l&apos;accès aux cercles live, C.O.R.E., AURORA OMEGA et plus encore au {periodEnd}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => actCancel('confirm', 'accept')} disabled={loading}
                data-testid="abo-confirm-cancel"
                className="rounded-full bg-red-500/80 hover:bg-red-500 px-5 py-2 text-sm font-semibold disabled:opacity-50">
                Confirmer l&apos;annulation
              </button>
              <button onClick={() => setFlowStep('none')} disabled={loading}
                className="rounded-full border border-white/20 px-5 py-2 text-sm">
                Garder mon abonnement
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold mb-4">Factures</h2>
          {invoices.length === 0 ? (
            <p className="text-white/50 text-sm">Aucune facture pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {invoices.map(inv => (
                <li key={inv.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-sm">{new Date(inv.created * 1000).toLocaleDateString('fr-FR')}</div>
                    <div className="text-xs text-white/50 uppercase">{inv.status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{((inv.amount_paid ?? 0) / 100).toFixed(2).replace('.', ',')}€</span>
                    {inv.invoice_pdf && (
                      <a href={inv.invoice_pdf} target="_blank" rel="noopener"
                        className="text-violet-400 hover:text-violet-300" aria-label="Télécharger la facture">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
