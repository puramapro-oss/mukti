'use client'

// MUKTI — G5.5 CustomAffirmationPanel
// Gère les affirmations perso par catégorie : liste + création + suggestions IA (Haiku) + soft-delete.
// Rate-limits côté serveur : 30/h create, 120/h list, 10/h suggest, 30/h delete.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, X, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { REPROG_CATEGORIES, type ReprogCategory } from '@/lib/constants'

interface CustomAffirmation {
  id: string
  user_id: string
  category: ReprogCategory
  text_user: string
  active: boolean
  created_at: string
}

interface Suggestion {
  text_fr: string
  text_en: string
}

export default function CustomAffirmationPanel() {
  const [category, setCategory] = useState<ReprogCategory>('confiance')
  const [items, setItems] = useState<CustomAffirmation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Création
  const [newText, setNewText] = useState('')
  const [creating, setCreating] = useState(false)

  // Suggestions IA
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestSaving, setSuggestSaving] = useState(false)

  const catMeta = useMemo(() => REPROG_CATEGORIES.find((c) => c.id === category)!, [category])
  const filteredItems = useMemo(() => items.filter((i) => i.category === category), [items, category])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/affirmations/custom', { method: 'GET' })
      if (!resp.ok) {
        const { error: apiErr } = await resp.json().catch(() => ({ error: null }))
        setError(apiErr ?? 'Impossible de charger tes affirmations.')
        return
      }
      const data = (await resp.json()) as { ok: boolean; items: CustomAffirmation[] }
      setItems(data.items ?? [])
    } catch {
      setError('Connexion perdue — réessaie.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function handleCreate() {
    const text = newText.trim()
    if (text.length < 5 || text.length > 300) {
      toast.error('Entre 5 et 300 caractères — écris-la comme tu la penses.')
      return
    }
    setCreating(true)
    try {
      const resp = await fetch('/api/affirmations/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, text }),
      })
      const data = (await resp.json()) as { ok: boolean; custom?: CustomAffirmation; error?: string }
      if (!resp.ok || !data.custom) {
        toast.error(data.error ?? 'Impossible de sauvegarder.')
        return
      }
      setItems((prev) => [data.custom!, ...prev])
      setNewText('')
      toast.success('Affirmation posée. Elle te reviendra aux bons moments. 🌱')
    } catch {
      toast.error('Connexion perdue — réessaie.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    const prev = items
    setItems((p) => p.filter((i) => i.id !== id))
    try {
      const resp = await fetch(`/api/affirmations/custom/${id}`, { method: 'DELETE' })
      if (!resp.ok) {
        setItems(prev)
        const { error: apiErr } = await resp.json().catch(() => ({ error: null }))
        toast.error(apiErr ?? 'Impossible de supprimer.')
        return
      }
      toast.success('Retirée. Tu peux toujours en créer de nouvelles.')
    } catch {
      setItems(prev)
      toast.error('Connexion perdue — réessaie.')
    }
  }

  async function handleSuggest() {
    setSuggestLoading(true)
    setSuggestions(null)
    setSelectedSuggestions(new Set())
    try {
      const resp = await fetch('/api/affirmations/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const data = (await resp.json()) as {
        ok: boolean
        suggestions?: Suggestion[]
        error?: string
      }
      if (!resp.ok || !data.suggestions?.length) {
        toast.error(data.error ?? 'Le générateur est indisponible — réessaie.')
        return
      }
      setSuggestions(data.suggestions)
    } catch {
      toast.error('Connexion perdue — réessaie.')
    } finally {
      setSuggestLoading(false)
    }
  }

  function toggleSuggestion(idx: number) {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function handleSaveSelected() {
    if (!suggestions || selectedSuggestions.size === 0) return
    setSuggestSaving(true)
    let saved = 0
    let failed = 0
    for (const idx of selectedSuggestions) {
      const s = suggestions[idx]
      if (!s) continue
      try {
        const resp = await fetch('/api/affirmations/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, text: s.text_fr }),
        })
        const data = (await resp.json()) as { ok: boolean; custom?: CustomAffirmation; error?: string }
        if (resp.ok && data.custom) {
          saved += 1
          setItems((prev) => [data.custom!, ...prev])
        } else {
          failed += 1
        }
      } catch {
        failed += 1
      }
    }
    setSuggestSaving(false)
    setSuggestions(null)
    setSelectedSuggestions(new Set())
    if (saved > 0) {
      toast.success(`${saved} affirmation${saved > 1 ? 's' : ''} sauvée${saved > 1 ? 's' : ''}. 🌱`)
    }
    if (failed > 0 && saved === 0) {
      toast.error('Aucune sauvegarde. Vérifie ta limite (100/catégorie).')
    }
  }

  return (
    <div className="space-y-6">
      {/* Catégorie switcher */}
      <div>
        <label className="text-[11px] uppercase tracking-[0.25em] text-white/50">
          Catégorie
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REPROG_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                category === c.id
                  ? 'border-white/30 bg-white/[0.12] text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06]'
              }`}
              style={category === c.id ? { borderColor: `${c.color}88` } : undefined}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Form créer */}
      <div
        className="rounded-2xl border p-5 backdrop-blur-xl"
        style={{
          borderColor: `${catMeta.color}30`,
          background: `linear-gradient(135deg, ${catMeta.color}08, transparent)`,
        }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base">{catMeta.emoji}</span>
          <span className="font-medium" style={{ color: catMeta.color }}>
            {catMeta.name}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            · {catMeta.solfeggio_hz} Hz
          </span>
        </div>

        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value.slice(0, 300))}
          placeholder="Écris ton affirmation (5-300 caractères)…"
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/30 focus:bg-white/[0.06] focus:outline-none"
          disabled={creating}
          maxLength={300}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {newText.length} / 300
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestLoading}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 backdrop-blur-xl transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {suggestLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>Suggestions IA</span>
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || newText.trim().length < 5}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.color}bb)`,
              }}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              <span>Créer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions IA */}
      {suggestions && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4" style={{ color: catMeta.color }} />
              <span>5 suggestions pour toi</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setSuggestions(null)
                setSelectedSuggestions(new Set())
              }}
              className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Fermer les suggestions"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="space-y-2">
            {suggestions.map((s, idx) => {
              const selected = selectedSuggestions.has(idx)
              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => toggleSuggestion(idx)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      selected
                        ? 'border-white/30 bg-white/[0.08] text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-transparent' : 'border-white/30'
                      }`}
                      style={selected ? { background: catMeta.color } : undefined}
                    >
                      {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 leading-relaxed">{s.text_fr}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={handleSaveSelected}
            disabled={suggestSaving || selectedSuggestions.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-[1.01] active:scale-100 disabled:scale-100 disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.color}bb)`,
            }}
          >
            {suggestSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            <span>
              Sauver {selectedSuggestions.size > 0 ? `(${selectedSuggestions.size})` : 'les sélectionnées'}
            </span>
          </button>
        </div>
      )}

      {/* Liste affirmations */}
      <div>
        <h3 className="mb-3 flex items-baseline justify-between text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          <span>Mes affirmations · {catMeta.name}</span>
          <span className="text-[10px]">
            {filteredItems.length} / 100
          </span>
        </h3>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Chargement…</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm italic text-white/40">
            Aucune affirmation perso dans cette catégorie. Les affirmations système tournent par défaut.
          </p>
        )}

        {filteredItems.length > 0 && (
          <ul className="space-y-2">
            {filteredItems.map((a) => (
              <li
                key={a.id}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm backdrop-blur-xl"
              >
                <span className="text-base">{catMeta.emoji}</span>
                <p className="flex-1 leading-relaxed text-white/85">{a.text_user}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="flex-shrink-0 rounded-full p-1.5 text-white/40 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                  aria-label="Retirer cette affirmation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
