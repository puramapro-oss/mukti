'use client'

// MUKTI — G5.5 AffirmationCreateForm
// Formulaire création affirmation perso : textarea + bouton Créer + bouton Suggestions IA.

import { Loader2, Plus, Sparkles } from 'lucide-react'
import type { ReprogCategory } from '@/lib/constants'

interface AffirmationCreateFormProps {
  category: ReprogCategory
  catMeta: { emoji: string; color: string; name: string; solfeggio_hz: number }
  newText: string
  creating: boolean
  suggestLoading: boolean
  onTextChange: (text: string) => void
  onCreate: () => void
  onSuggest: () => void
}

export default function AffirmationCreateForm({
  catMeta,
  newText,
  creating,
  suggestLoading,
  onTextChange,
  onCreate,
  onSuggest,
}: AffirmationCreateFormProps) {
  return (
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
        onChange={(e) => onTextChange(e.target.value.slice(0, 300))}
        placeholder="Écris ton affirmation (5-300 caractères)…"
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/30 focus:bg-white/[0.06] focus:outline-none"
        disabled={creating}
        maxLength={300}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{newText.length} / 300</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSuggest}
            disabled={suggestLoading}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 backdrop-blur-xl transition-colors hover:bg-white/[0.08] disabled:opacity-50"
          >
            {suggestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span>Suggestions IA</span>
          </button>
          <button
            type="button"
            onClick={onCreate}
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
  )
}
