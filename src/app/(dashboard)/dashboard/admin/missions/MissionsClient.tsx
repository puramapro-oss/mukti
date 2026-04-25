'use client'

// MUKTI G8.6 — Missions client : table + create/edit modal + delete

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, X, Save, AlertCircle } from 'lucide-react'
import type { MissionRow } from '@/lib/admin-missions'
import { MISSION_TYPES, type MissionType } from '@/lib/constants'

interface Props {
  initialMissions: MissionRow[]
}

interface FormState {
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

const EMPTY_FORM: FormState = {
  slug: '',
  title_fr: '',
  title_en: '',
  description_fr: '',
  description_en: '',
  type: 'action',
  category: '',
  reward_points: 0,
  reward_amount_cents: 0,
  active: true,
  sort_order: 0,
}

const TYPE_LABELS: Record<MissionType, string> = {
  action: 'Action',
  share: 'Partage',
  referral: 'Parrainage',
  meditation: 'Méditation',
  community: 'Communauté',
  other: 'Autre',
}

export default function MissionsClient({ initialMissions }: Props) {
  const [missions, setMissions] = useState<MissionRow[]>(initialMissions)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function startCreate() {
    setEditing({ ...EMPTY_FORM })
    setError(null)
  }

  function startEdit(m: MissionRow) {
    setEditing({
      id: m.id,
      slug: m.slug,
      title_fr: m.title_fr,
      title_en: m.title_en,
      description_fr: m.description_fr ?? '',
      description_en: m.description_en ?? '',
      type: m.type,
      category: m.category ?? '',
      reward_points: m.reward_points,
      reward_amount_cents: m.reward_amount_cents,
      active: m.active,
      sort_order: m.sort_order,
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
    const url = isNew ? '/api/admin/missions' : `/api/admin/missions/${editing.id}`
    const method = isNew ? 'POST' : 'PUT'
    const body: Record<string, unknown> = {
      title_fr: editing.title_fr,
      title_en: editing.title_en,
      description_fr: editing.description_fr || null,
      description_en: editing.description_en || null,
      type: editing.type,
      category: editing.category || null,
      reward_points: editing.reward_points,
      reward_amount_cents: editing.reward_amount_cents,
      active: editing.active,
      sort_order: editing.sort_order,
    }
    if (isNew) body.slug = editing.slug

    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Enregistrement impossible.')
        return
      }
      const data = (await res.json()) as { mission: MissionRow }
      setMissions((prev) => {
        if (isNew) return [data.mission, ...prev]
        return prev.map((m) => (m.id === data.mission.id ? data.mission : m))
      })
      setEditing(null)
    })
  }

  function handleDelete(id: string, slug: string) {
    if (!window.confirm(`Supprimer la mission "${slug}" ?`)) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/missions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Suppression impossible.')
        return
      }
      setMissions((prev) => prev.filter((m) => m.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvelle mission
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
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Titre FR</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3 text-right">Cents</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {missions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/45">
                  Aucune mission. Crée la première avec <span className="text-white/75">Nouvelle mission</span>.
                </td>
              </tr>
            ) : null}
            {missions.map((m) => (
              <tr key={m.id} className="text-white/85">
                <td className="px-4 py-3 font-mono text-fuchsia-300">{m.slug}</td>
                <td className="px-4 py-3">{m.title_fr}</td>
                <td className="px-4 py-3 text-white/70">{TYPE_LABELS[m.type]}</td>
                <td className="px-4 py-3 text-right">{m.reward_points}</td>
                <td className="px-4 py-3 text-right">{m.reward_amount_cents}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      m.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {m.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      aria-label={`Modifier ${m.slug}`}
                      className="rounded-md border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.slug)}
                      aria-label={`Supprimer ${m.slug}`}
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
          aria-labelledby="mission-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0E0E15] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 id="mission-modal-title" className="text-lg font-semibold text-white">
                {editing.id ? 'Modifier la mission' : 'Nouvelle mission'}
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
                <label className="block text-xs font-medium text-white/70">Slug (immuable)</label>
                <input
                  type="text"
                  value={editing.slug}
                  disabled={!!editing.id}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-fuchsia-400/60 disabled:opacity-50"
                  placeholder="ma_mission_unique"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Titre FR</label>
                  <input
                    type="text"
                    value={editing.title_fr}
                    onChange={(e) => setEditing({ ...editing, title_fr: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Titre EN</label>
                  <input
                    type="text"
                    value={editing.title_en}
                    onChange={(e) => setEditing({ ...editing, title_en: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Description FR</label>
                  <textarea
                    rows={2}
                    value={editing.description_fr}
                    onChange={(e) => setEditing({ ...editing, description_fr: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Description EN</label>
                  <textarea
                    rows={2}
                    value={editing.description_en}
                    onChange={(e) => setEditing({ ...editing, description_en: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70">Type</label>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value as MissionType })}
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
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                    placeholder="onboarding"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Sort order</label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
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
                    value={editing.reward_points}
                    onChange={(e) => setEditing({ ...editing, reward_points: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70">Récompense cents</label>
                  <input
                    type="number"
                    min="0"
                    value={editing.reward_amount_cents}
                    onChange={(e) => setEditing({ ...editing, reward_amount_cents: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-black/40 text-fuchsia-500"
                />
                Active
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
      ) : null}
    </div>
  )
}
