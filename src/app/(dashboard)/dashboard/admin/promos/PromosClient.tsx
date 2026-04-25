'use client'

// MUKTI G8.6 — Promos client : table + create/edit/delete + audit auto

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, X, Save, AlertCircle, Check } from 'lucide-react'
import type { PromoRow } from '@/lib/admin-promos'

interface Props {
  initialPromos: PromoRow[]
}

interface FormState {
  id?: string
  code: string
  label: string
  discount_type: 'percent' | 'amount'
  discount_value: number
  duration: 'once' | 'forever' | 'repeating'
  duration_in_months: number | null
  valid_until: string | null
  max_redemptions: number | null
  active: boolean
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

  function handleSave() {
    if (!editing) return
    setError(null)
    const isNew = !editing.id
    const url = isNew ? '/api/admin/promos' : `/api/admin/promos/${editing.id}`
    const method = isNew ? 'POST' : 'PUT'
    const body: Record<string, unknown> = {
      label: editing.label,
      discount_type: editing.discount_type,
      discount_value: editing.discount_value,
      duration: editing.duration,
      duration_in_months: editing.duration === 'repeating' ? editing.duration_in_months ?? 1 : null,
      valid_until: editing.valid_until,
      max_redemptions: editing.max_redemptions,
      active: editing.active,
    }
    if (isNew) body.code = editing.code
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

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0E15] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 id="promo-modal-title" className="text-lg font-semibold text-white">
                {editing.id ? 'Modifier le code' : 'Nouveau code promo'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Fermer"
                className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/70">Code</label>
                <input
                  type="text"
                  value={editing.code}
                  disabled={!!editing.id}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-400/60 disabled:opacity-50"
                  placeholder="WELCOME10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70">Libellé interne</label>
                <input
                  type="text"
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  placeholder="Bienvenue 10%"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Type</label>
                  <select
                    value={editing.discount_type}
                    onChange={(e) => setEditing({ ...editing, discount_type: e.target.value as FormState['discount_type'] })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  >
                    <option value="percent">Pourcentage</option>
                    <option value="amount">Montant fixe (cents)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Valeur</label>
                  <input
                    type="number"
                    min="1"
                    value={editing.discount_value}
                    onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Durée</label>
                  <select
                    value={editing.duration}
                    onChange={(e) => setEditing({ ...editing, duration: e.target.value as FormState['duration'] })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  >
                    <option value="once">Une fois</option>
                    <option value="forever">À vie</option>
                    <option value="repeating">N mois</option>
                  </select>
                </div>
                {editing.duration === 'repeating' ? (
                  <div>
                    <label className="block text-xs font-medium text-white/70">Mois</label>
                    <input
                      type="number"
                      min="1"
                      value={editing.duration_in_months ?? 1}
                      onChange={(e) => setEditing({ ...editing, duration_in_months: Number(e.target.value) })}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                    />
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Expiration</label>
                  <input
                    type="datetime-local"
                    value={editing.valid_until ? editing.valid_until.slice(0, 16) : ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        valid_until: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Max utilisations</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="∞"
                    value={editing.max_redemptions ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, max_redemptions: e.target.value ? Number(e.target.value) : null })
                    }
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-black/40 text-amber-500"
                />
                Actif
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:bg-white/10 disabled:text-white/40"
              >
                {pending ? (
                  'Enregistrement…'
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
