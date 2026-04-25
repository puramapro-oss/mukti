// MUKTI G8.6 — Sous-page admin Promos : CRUD codes Stripe

import { listPromos } from '@/lib/admin-promos'
import PromosClient from './PromosClient'

export const dynamic = 'force-dynamic'

export default async function AdminPromosPage() {
  const promos = await listPromos()
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Codes promo</h1>
        <p className="text-sm text-white/60">
          % de réduction ou montant fixe (cents). Durée <em>once</em> = 1× au checkout, <em>forever</em> = à vie, <em>repeating</em> = N mois.
          Les codes sont synchronisés Stripe lors de la première utilisation.
        </p>
      </header>
      <PromosClient initialPromos={promos} />
    </div>
  )
}
