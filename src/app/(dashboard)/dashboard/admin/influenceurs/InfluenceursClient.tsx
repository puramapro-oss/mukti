'use client'

// MUKTI G8.6 — Influenceurs commissions client : filters + table + status override

import { useEffect, useState, useTransition } from 'react'
import { AlertCircle, Filter, RefreshCw, ChevronDown } from 'lucide-react'
import type { CommissionRowEnriched, CommissionStatus, CommissionType } from '@/lib/admin-commissions'

interface Props {
  initial: { rows: CommissionRowEnriched[]; total: number; sum_cents: number }
}

const STATUSES: ReadonlyArray<{ value: '' | CommissionStatus; label: string }> = [
  { value: '', label: 'Tous statuts' },
  { value: 'pending', label: 'Pending' },
  { value: 'credited', label: 'Credited' },
  { value: 'paid', label: 'Paid' },
]

const TYPES: ReadonlyArray<{ value: '' | CommissionType; label: string }> = [
  { value: '', label: 'Tous types' },
  { value: 'n1_abo', label: 'N1 Abonnement' },
  { value: 'recurring', label: 'Récurrente' },
  { value: 'ambassador', label: 'Ambassadeur' },
]

const STATUS_BADGE: Record<CommissionStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-400/30',
  credited: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30',
  paid: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
}

function formatEuros(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function InfluenceursClient({ initial }: Props) {
  const [rows, setRows] = useState<CommissionRowEnriched[]>(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [sumCents, setSumCents] = useState(initial.sum_cents)
  const [statusFilter, setStatusFilter] = useState<'' | CommissionStatus>('')
  const [typeFilter, setTypeFilter] = useState<'' | CommissionType>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function refresh() {
    setError(null)
    startTransition(async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/admin/influenceurs/commissions?${params.toString()}`)
      if (!res.ok) {
        setError('Impossible de charger les commissions.')
        return
      }
      const data = (await res.json()) as { rows: CommissionRowEnriched[]; total: number; sum_cents: number }
      setRows(data.rows)
      setTotal(data.total)
      setSumCents(data.sum_cents)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  function setStatus(id: string, newStatus: CommissionStatus) {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/influenceurs/commissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Impossible de mettre à jour le statut.')
        return
      }
      refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="status-filter" className="block text-xs text-white/50">
              <Filter className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Statut
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | CommissionStatus)}
              className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-xs text-white/50">
              Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | CommissionType)}
              className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            aria-label="Actualiser la liste"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
            Actualiser
          </button>
        </div>
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm">
          <div className="text-xs text-emerald-200/80">Total filtré</div>
          <div className="text-base font-semibold text-emerald-100">
            {formatEuros(sumCents)} <span className="text-xs font-normal text-emerald-200/60">/ {total} entrées</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-white/55">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/45">
                  Aucune commission ne correspond à ces filtres.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="text-white/85">
                <td className="px-4 py-3 text-xs text-white/65">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{r.user_full_name ?? '—'}</div>
                  <div className="text-xs text-white/50">{r.user_email ?? r.user_id}</div>
                </td>
                <td className="px-4 py-3 text-white/70">{r.type}</td>
                <td className="px-4 py-3 text-right font-medium">{formatEuros(r.amount_cents)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="relative inline-block">
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value as CommissionStatus)}
                      disabled={pending}
                      aria-label={`Changer le statut de la commission ${r.id}`}
                      className="appearance-none rounded-md border border-white/10 bg-black/40 px-2.5 py-1 pr-7 text-xs text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
                    >
                      <option value="pending">pending</option>
                      <option value="credited">credited</option>
                      <option value="paid">paid</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/50" aria-hidden="true" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
