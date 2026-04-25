// MUKTI G8.6 — Sous-page admin Pricing : 3 prix live editables

import { getSetting } from '@/lib/admin-settings'
import PricingEditor from './PricingEditor'

export const dynamic = 'force-dynamic'

export default async function AdminPricingPage() {
  const [monthly, annual, antiChurn] = await Promise.all([
    getSetting<number>('pricing_main_monthly_cents'),
    getSetting<number>('pricing_main_annual_cents'),
    getSetting<number>('pricing_anti_churn_cents'),
  ])

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Pricing</h1>
        <p className="text-sm text-white/60">
          Prix appliqués en live partout dans MUKTI (page <code className="rounded bg-white/10 px-1 text-white/80">/pricing</code>, Stripe checkout, anti-churn flow).
          Chaque modification est tracée dans l&apos;audit log.
        </p>
      </header>
      <PricingEditor
        initialMonthly={typeof monthly === 'number' ? monthly : 999}
        initialAnnual={typeof annual === 'number' ? annual : 7990}
        initialAntiChurn={typeof antiChurn === 'number' ? antiChurn : 499}
      />
    </div>
  )
}
