'use client'

// MUKTI — G5.5 AISuggestionsPanel
// Affiche les 5 suggestions IA avec sélection multiple + bouton Sauver.

import { Check, Loader2, Plus, Sparkles, X } from 'lucide-react'
import type { ReprogCategory } from '@/lib/constants'

interface Suggestion {
  text_fr: string
  text_en: string
}

interface AISuggestionsPanelProps {
  suggestions: Suggestion[]
  selectedSuggestions: Set<number>
  category: ReprogCategory
  catMeta: { emoji: string; color: string; name: string }
  suggestSaving: boolean
  onToggleSuggestion: (idx: number) => void
  onSaveSelected: () => void
  onClose: () => void
}

export default function AISuggestionsPanel({
  suggestions,
  selectedSuggestions,
  catMeta,
  suggestSaving,
  onToggleSuggestion,
  onSaveSelected,
  onClose,
}: AISuggestionsPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4" style={{ color: catMeta.color }} />
          <span>5 suggestions pour toi</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
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
                onClick={() => onToggleSuggestion(idx)}
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
        onClick={onSaveSelected}
        disabled={suggestSaving || selectedSuggestions.size === 0}
        className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-[1.01] active:scale-100 disabled:scale-100 disabled:opacity-40"
        style={{
          background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.color}bb)`,
        }}
      >
        {suggestSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        <span>Sauver {selectedSuggestions.size > 0 ? `(${selectedSuggestions.size})` : 'les sélectionnées'}</span>
      </button>
    </div>
  )
}
