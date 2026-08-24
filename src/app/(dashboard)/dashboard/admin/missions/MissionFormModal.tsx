'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { MISSION_TYPES, type MissionType } from '@/lib/constants'

export interface FormState {
  id?: string
  slug: string
  title_fr: string
  title_en: string
  description_fr: string
  description_en: string
  type: MissionType
  category: string
  reward_points: number
  reward_amount_cents: number
  active: boolean
  sort_order: number
}

export const TYPE_LABELS: Record<MissionType, string> = {
  action: 'Action',
  share: 'Partage',
  referral: 'Parrainage',
  meditation: 'Méditation',
  community: 'Communauté',
  other: 'Autre',
}

interface Props {
  initial: FormState
  pending: boolean
  onClose: () => void
  onSave: (form: FormState) => void
}

export default function MissionFormModal({ initial, pending, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(initial)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0E0E15] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="mission-modal-title" className="text-lg font-semibold text-white">
            {form.id ? 'Modifier la mission' : 'Nouvelle mission'}
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
            <label className="block text-xs font-medium text-white/70">Slug (immuable)</label>
            <input
              type="text"
              value={form.slug}
              disabled={!!form.id}
              onChange={(e) =>
                setForm({
                  ...form,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
                })
              }
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-fuchsia-400/60 disabled:opacity-50"
              placeholder="ma_mission_unique"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Titre FR</label>
              <input
                type="text"
                value={form.title_fr}
                onChange={(e) => setForm({ ...form, title_fr: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70">Titre EN</label>
              <input
                type="text"
                value={form.title_en}
                onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Description FR</label>
              <textarea
                rows={2}
                value={form.description_fr}
                onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70">Description EN</label>
              <textarea
                rows={2}
                value={form.description_en}
                onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MissionType })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              >
                {MISSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70">Catégorie</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                placeholder="onboarding"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70">Sort order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70">Récompense points</label>
              <input
                type="number"
                min="0"
                value={form.reward_points}
                onChange={(e) => setForm({ ...form, reward_points: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70">Récompense cents</label>
              <input
                type="number"
                min="0"
                value={form.reward_amount_cents}
                onChange={(e) => setForm({ ...form, reward_amount_cents: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/85">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-fuchsia-500"
            />
            Active
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:bg-white/10 disabled:text-white/40"
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
