import { Check, Radio, Loader2 } from 'lucide-react'
import { CIRCLE_GUIDANCE_MODES, type CircleGuidanceMode } from '@/lib/constants'
import type { Phrase } from './types'

interface Step3Props {
  guidanceMode: CircleGuidanceMode
  phrases: Phrase[]
  phrasesLoading: boolean
  selectedPhraseIds: string[]
  onChangeGuidance: (m: CircleGuidanceMode) => void
  onTogglePhrase: (id: string) => void
}

export default function Step3(props: Step3Props) {
  const needsPhrases = props.guidanceMode === 'voice' || props.guidanceMode === 'mental' || props.guidanceMode === 'light'
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Le mode de guidage</h2>
        <p className="mt-1 text-sm text-white/55">Comment vous allez vous synchroniser.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CIRCLE_GUIDANCE_MODES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => props.onChangeGuidance(g.id as CircleGuidanceMode)}
            data-testid={`wizard-guidance-${g.id}`}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
              props.guidanceMode === g.id
                ? 'border-white/30 bg-white/[0.06]'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-lg">{g.emoji}</span>
            <div>
              <p className="text-xs font-medium text-white/90">{g.name}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">{g.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {needsPhrases && (
        <div className="flex flex-col gap-3 border-t border-white/5 pt-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
              <Radio className="h-3.5 w-3.5" /> Phrases conscientes
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Choisis 3 à 10 phrases qui seront affichées pendant la rotation. Si aucune choisie, une sélection aléatoire sera faite.
            </p>
          </div>

          {props.phrasesLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des phrases…
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {props.phrases.map((p) => {
                const on = props.selectedPhraseIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => props.onTogglePhrase(p.id)}
                    data-testid={`phrase-${p.id}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      on
                        ? 'border-[var(--cyan)]/40 bg-[var(--cyan)]/10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        on ? 'border-[var(--cyan)] bg-[var(--cyan)]' : 'border-white/20'
                      }`}
                    >
                      {on && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="text-sm text-white/85">« {p.text_fr} »</span>
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-white/40">
            {props.selectedPhraseIds.length} phrase{props.selectedPhraseIds.length > 1 ? 's' : ''} sélectionnée{props.selectedPhraseIds.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
