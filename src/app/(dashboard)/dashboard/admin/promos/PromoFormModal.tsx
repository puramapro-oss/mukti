'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'

export interface FormState {
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

interface Props {
  initial: FormState
  pending: boolean
  onClose: () => void
  onSave: (form: FormState) => void
}

export default function PromoFormModal({ initial, pending, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(initial)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0E15] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="promo-modal-title" className="text-lg font-semibold text-white">
            {form.id ? 'Modifier le code' : 'Nouveau code promo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
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
              value={form.code}
              disabled={!!form.id}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-400/60 disabled:opacity-50"
              placeholder="WELCOME10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70">Libellé interne</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
              placeholder="Bienvenue 10%"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Type</label>
              <select
                value={form.discount_type}
                onChange={(e) =>
                  setForm({ ...form, discount_type: e.target.value as FormState['discount_type'] })
                }
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
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Durée</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value as FormState['duration'] })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
              >
                <option value="once">Une fois</option>
                <option value="forever">À vie</option>
                <option value="repeating">N mois</option>
              </select>
            </div>
            {form.duration === 'repeating' && (
              <div>
                <label className="block text-xs font-medium text-white/70">Mois</label>
                <input
                  type="number"
                  min="1"
                  value={form.duration_in_months ?? 1}
                  onChange={(e) => setForm({ ...form, duration_in_months: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Expiration</label>
              <input
                type="datetime-local"
                value={form.valid_until ? form.valid_until.slice(0, 16) : ''}
                onChange={(e) =>
                  setForm({
                    ...form,
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
                value={form.max_redemptions ?? ''}
                onChange={(e) =>
                  setForm({ ...form, max_redemptions: e.target.value ? Number(e.target.value) : null })
                }
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/85">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-amber-500"
            />
            Actif
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
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
  )
}
