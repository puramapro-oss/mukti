'use client'

// MUKTI G8.6 — Missions client : table + create/edit modal + delete

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import type { MissionRow } from '@/lib/admin-missions'
import MissionFormModal, { type FormState, TYPE_LABELS } from './MissionFormModal'

interface Props {
  initialMissions: MissionRow[]
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

  function handleSave(form: FormState) {
    setError(null)
    const isNew = !form.id
    const url = isNew ? '/api/admin/missions' : `/api/admin/missions/${form.id}`
    const method = isNew ? 'POST' : 'PUT'
    const body: Record<string, unknown> = {
      title_fr: form.title_fr,
      title_en: form.title_en,
      description_fr: form.description_fr || null,
      description_en: form.description_en || null,
      type: form.type,
      category: form.category || null,
      reward_points: form.reward_points,
      reward_amount_cents: form.reward_amount_cents,
      active: form.active,
      sort_order: form.sort_order,
    }
    if (isNew) body.slug = form.slug

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

      {editing && <MissionFormModal initial={editing} pending={pending} onClose={closeForm} onSave={handleSave} />}
    </div>
  )
}
