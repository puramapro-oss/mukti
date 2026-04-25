'use client'

// MUKTI G8.6 — Audit log viewer : table + filters + pagination + CSV export + JSON expand

import { useEffect, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Download, Filter, RefreshCw } from 'lucide-react'
import type { AuditLogRow } from '@/lib/admin-settings'

interface Props {
  initial: { rows: AuditLogRow[]; total: number }
}

const PAGE_SIZE = 50

const COMMON_ACTIONS = [
  '',
  'setting_update',
  'promo_create',
  'promo_update',
  'promo_delete',
  'mission_create',
  'mission_update',
  'mission_delete',
  'commission_status_update',
] as const

const COMMON_TABLES = ['', 'admin_settings', 'promos', 'missions', 'commissions'] as const

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function rowsToCsv(rows: AuditLogRow[]): string {
  const headers = ['id', 'created_at', 'admin_user_id', 'action', 'target_table', 'target_id', 'ip_address', 'user_agent', 'before_value', 'after_value']
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(','))
  }
  return lines.join('\n')
}

export default function AuditClient({ initial }: Props) {
  const [rows, setRows] = useState<AuditLogRow[]>(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function load(targetPage = page) {
    startTransition(async () => {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(targetPage * PAGE_SIZE))
      if (actionFilter) params.set('action', actionFilter)
      if (tableFilter) params.set('target_table', tableFilter)
      if (from) params.set('from', new Date(from).toISOString())
      if (to) params.set('to', new Date(to).toISOString())
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      if (!res.ok) return
      const data = (await res.json()) as { rows: AuditLogRow[]; total: number }
      setRows(data.rows)
      setTotal(data.total)
    })
  }

  useEffect(() => {
    setPage(0)
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, tableFilter, from, to])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportCsv() {
    const csv = rowsToCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mukti-audit-page-${page + 1}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action-filter" className="block text-xs text-white/50">
            <Filter className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Action
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-slate-300"
          >
            {COMMON_ACTIONS.map((a) => (
              <option key={a || 'any'} value={a}>
                {a || 'Toutes'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="table-filter" className="block text-xs text-white/50">
            Table
          </label>
          <select
            id="table-filter"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-slate-300"
          >
            {COMMON_TABLES.map((t) => (
              <option key={t || 'any'} value={t}>
                {t || 'Toutes'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block text-xs text-white/50">
            Du
          </label>
          <input
            id="from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-slate-300"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs text-white/50">
            Au
          </label>
          <input
            id="to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualiser
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV (page)
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <ul className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-white/45">Aucune entrée audit pour ces filtres.</li>
          ) : null}
          {rows.map((r) => {
            const isOpen = expanded.has(r.id)
            return (
              <li key={r.id} className="px-4 py-3 text-sm">
                <button
                  type="button"
                  onClick={() => toggleExpand(r.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`audit-detail-${r.id}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-white/50">{formatDate(r.created_at)}</span>
                    <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
                      {r.action}
                    </span>
                    <span className="text-xs text-white/65">
                      <span className="text-white/45">table:</span> {r.target_table ?? '—'}
                    </span>
                    {r.target_id ? (
                      <span className="font-mono text-[10px] text-white/40">{r.target_id.slice(0, 8)}…</span>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-white/50" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/50" aria-hidden="true" />
                  )}
                </button>
                {isOpen ? (
                  <div id={`audit-detail-${r.id}`} className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-rose-300/80">Avant</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-white/70">
                        {r.before_value ? JSON.stringify(r.before_value, null, 2) : '—'}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300/80">Après</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-white/70">
                        {r.after_value ? JSON.stringify(r.after_value, null, 2) : '—'}
                      </pre>
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-2 gap-2 text-[11px] text-white/55">
                      <div>
                        <span className="text-white/40">IP:</span> {r.ip_address ?? '—'}
                      </div>
                      <div className="truncate">
                        <span className="text-white/40">UA:</span> {r.user_agent ?? '—'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between text-xs text-white/55">
        <p>
          Page <span className="text-white/85">{page + 1}</span> / {totalPages} — {total} entrées au total
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const p = Math.max(0, page - 1)
              setPage(p)
              load(p)
            }}
            disabled={page === 0 || pending}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            Précédent
          </button>
          <button
            type="button"
            onClick={() => {
              const p = Math.min(totalPages - 1, page + 1)
              setPage(p)
              load(p)
            }}
            disabled={page >= totalPages - 1 || pending}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  )
}
