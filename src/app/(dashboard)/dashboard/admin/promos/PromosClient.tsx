'use client'

// MUKTI G8.6 — Promos client : table + create/edit/delete + audit auto

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import type { PromoRow } from '@/lib/admin-promos'
import PromoFormModal, { type FormState } from './PromoFormModal'

interface Props {
  initialPromos: PromoRow[]
}

const EMPTY_FORM: FormState = {
  code: '',
  label: '',
  discount_type: 'percent',
  discount_value: 10,
  duration: 'once',
  duration_in_months: null,
  valid_until: null,
  max_redemptions: null,
  active: true,
}

function formatDiscount(p: PromoRow): string {
  return p.discount_type === 'percent' ? `-${p.discount_value} %` : `-${(p.discount_value / 100).toFixed(2)} €`
}

export default function PromosClient({ initialPromos }: Props) {
  const [promos, setPromos] = useState<PromoRow[]>(initialPromos)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function startCreate() {
    setEditing({ ...EMPTY_FORM })
    setError(null)
  }

  function startEdit(p: PromoRow) {
    setEditing({
      id: p.id,
      code: p.code,
      label: p.label,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      duration: p.duration,
      duration_in_months: p.duration_in_months,
      valid_until: p.valid_until,
      max_redemptions: p.max_redemptions,
      active: p.active,
    })
    setError(null)
  }

  function closeForm() {
    setEditing(null)
    setError(null)
  }

  function handleSave(form: FormState) {
    setError(null)
    const isNew = !form.id
    const url = isNew ? '/api/admin/promos' : `/api/admin/promos/${form.id}`
    const method = isNew ? 'POST' : 'PUT'
    const body: Record<string, unknown> = {
      label: form.label,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      duration: form.duration,
      duration_in_months: form.duration === 'repeating' ? form.duration_in_months ?? 1 : null,
      valid_until: form.valid_until,
      max_redemptions: form.max_redemptions,
      active: form.active,
    }
    if (isNew) body.code = form.code
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Erreur lors de l\'enregistrement.')
        return
      }
      const data = (await res.json()) as { promo: PromoRow }
      setPromos((prev) => {
        if (isNew) return [data.promo, ...prev]
        return prev.map((p) => (p.id === data.promo.id ? data.promo : p))
      })
      setEditing(null)
    })
  }

  function handleDelete(id: string, code: string) {
    if (!window.confirm(`Supprimer le code "${code}" ?`)) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/promos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Suppression impossible.')
        return
      }
      setPromos((prev) => prev.filter((p) => p.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouveau code
        </button>
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
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Réduction</th>
              <th className="px-4 py-3">Durée</th>
              <th className="px-4 py-3">Utilisations</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {promos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/45">
                  Aucun code promo. Crée le premier avec <span className="text-white/75">Nouveau code</span>.
                </td>
              </tr>
            ) : null}
            {promos.map((p) => (
              <tr key={p.id} className="text-white/85">
                <td className="px-4 py-3 font-mono text-amber-300">{p.code}</td>
                <td className="px-4 py-3">{p.label}</td>
                <td className="px-4 py-3 font-medium">{formatDiscount(p)}</td>
                <td className="px-4 py-3 text-white/65">
                  {p.duration === 'repeating' ? `${p.duration_in_months ?? '?'} mois` : p.duration}
                </td>
                <td className="px-4 py-3 text-white/65">
                  {p.redemptions_count}
                  {p.max_redemptions ? ` / ${p.max_redemptions}` : ' / ∞'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      p.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {p.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      aria-label={`Modifier ${p.code}`}
                      className="rounded-md border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.code)}
                      aria-label={`Supprimer ${p.code}`}
                      className="rounded-md border border-rose-400/20 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <PromoFormModal initial={editing} pending={pending} onClose={closeForm} onSave={handleSave} />}
    </div>
  )
}
