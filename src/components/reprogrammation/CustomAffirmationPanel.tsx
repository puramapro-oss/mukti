'use client'

// MUKTI — G5.5 CustomAffirmationPanel
// Gère les affirmations perso par catégorie : liste + création + suggestions IA (Haiku) + soft-delete.
// Rate-limits côté serveur : 30/h create, 120/h list, 10/h suggest, 30/h delete.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { REPROG_CATEGORIES, type ReprogCategory } from '@/lib/constants'
import AISuggestionsPanel from './AISuggestionsPanel'
import AffirmationCreateForm from './AffirmationCreateForm'

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
      <AffirmationCreateForm
        category={category}
        catMeta={catMeta}
        newText={newText}
        creating={creating}
        suggestLoading={suggestLoading}
        onTextChange={setNewText}
        onCreate={handleCreate}
        onSuggest={handleSuggest}
      />

      {/* Suggestions IA */}
      {suggestions && (
        <AISuggestionsPanel
          suggestions={suggestions}
          selectedSuggestions={selectedSuggestions}
          category={category}
          catMeta={catMeta}
          suggestSaving={suggestSaving}
          onToggleSuggestion={toggleSuggestion}
          onSaveSelected={handleSaveSelected}
          onClose={() => {
            setSuggestions(null)
            setSelectedSuggestions(new Set())
          }}
        />
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
