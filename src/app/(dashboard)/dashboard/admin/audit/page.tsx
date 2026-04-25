// MUKTI G8.6 — Sous-page admin Audit log : viewer paginated + filtres + export CSV

import { listAuditLog } from '@/lib/admin-settings'
import AuditClient from './AuditClient'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  const initial = await listAuditLog({ limit: 50, offset: 0 })
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Audit log</h1>
        <p className="text-sm text-white/60">
          Historique de toutes les actions super_admin avec before/after JSON, IP et user-agent. Filtres par action,
          table, date. Export CSV pour audit comptable / RGPD.
        </p>
      </header>
      <AuditClient initial={initial} />
    </div>
  )
}
