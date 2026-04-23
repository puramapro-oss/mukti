'use client'

import { useEffect, useState } from 'react'
import type { CircleGuidanceMode, CircleCategoryId } from '@/lib/constants'
import { CIRCLE_CATEGORIES } from '@/lib/constants'
import ModeFrame from './ModeFrame'
import VoiceGuidedMode from './VoiceGuidedMode'
import BreathSyncMode from './BreathSyncMode'
import VisualizationMode from './VisualizationMode'
import MentalRepetitionMode from './MentalRepetitionMode'
import IntentionalSilenceMode from './IntentionalSilenceMode'
import ContinuousSoundMode from './ContinuousSoundMode'
import LightSymbolMode from './LightSymbolMode'
import PureIntentionMode from './PureIntentionMode'

interface Phrase {
  id: string
  text_fr: string
  text_en: string
}

interface GuidanceSwitcherProps {
  guidanceMode: CircleGuidanceMode
  category: CircleCategoryId
  rotationStartedAt: string | null
  rotationDurationSec: number
  secondsRemaining: number
  progressPercent: number
  focusedName: string | null
  selectedPhraseIds: string[]
  locale?: 'fr' | 'en'
}

const INTENTION_WORD_BY_CATEGORY: Record<string, string> = {
  abondance: 'ABONDANCE',
  amour_soi: 'AMOUR',
  apaisement: 'APAISEMENT',
  motivation: 'ÉLAN',
  renouveau: 'RENOUVEAU',
  confiance: 'CONFIANCE',
  protection: 'PROTECTION',
  alignement: 'ALIGNEMENT',
  paix: 'PAIX',
  ancrage: 'ANCRAGE',
  clarte: 'CLARTÉ',
  gratitude: 'GRATITUDE',
  liberation: 'LIBÉRATION',
  manifestation: 'MANIFESTATION',
}

export default function GuidanceSwitcher(props: GuidanceSwitcherProps) {
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const cat = CIRCLE_CATEGORIES.find((c) => c.id === props.category)
  const accentColor = cat?.color ?? '#7C3AED'

  useEffect(() => {
    if (props.selectedPhraseIds.length === 0) {
      // fallback : fetch toutes les phrases de la catégorie
      fetch(`/api/intention-phrases?category=${props.category}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setPhrases(d.phrases as Phrase[])
        })
        .catch(() => {})
    } else {
      fetch(`/api/intention-phrases?category=${props.category}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            const all = d.phrases as Phrase[]
            const selected = all.filter((p) => props.selectedPhraseIds.includes(p.id))
            setPhrases(selected.length > 0 ? selected : all)
          }
        })
        .catch(() => {})
    }
  }, [props.category, props.selectedPhraseIds])

  const mm = Math.floor(props.secondsRemaining / 60)
  const ss = props.secondsRemaining % 60
  const timerLabel = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const intentionWord = INTENTION_WORD_BY_CATEGORY[props.category] ?? 'PAIX'

  return (
    <ModeFrame timerLabel={timerLabel} progressPercent={props.progressPercent} accentColor={accentColor}>
      {props.guidanceMode === 'voice' && (
        <VoiceGuidedMode phrases={phrases} locale={props.locale} rotationSeconds={props.rotationDurationSec} />
      )}
      {props.guidanceMode === 'breath' && (
        <BreathSyncMode startedAt={props.rotationStartedAt} accentColor={accentColor} />
      )}
      {props.guidanceMode === 'visualization' && (
        <VisualizationMode startedAt={props.rotationStartedAt} accentColor={accentColor} />
      )}
      {props.guidanceMode === 'mental' && (
        <MentalRepetitionMode phrase={phrases[0] ?? null} locale={props.locale} />
      )}
      {props.guidanceMode === 'silence' && (
        <IntentionalSilenceMode focusedName={props.focusedName} secondsRemaining={props.secondsRemaining} />
      )}
      {props.guidanceMode === 'sound' && (
        <ContinuousSoundMode category={props.category} accentColor={accentColor} />
      )}
      {props.guidanceMode === 'light' && (
        <LightSymbolMode category={props.category} accentColor={accentColor} />
      )}
      {props.guidanceMode === 'pure' && (
        <PureIntentionMode
          focusedName={props.focusedName}
          intentionWord={intentionWord}
          secondsRemaining={props.secondsRemaining}
        />
      )}
    </ModeFrame>
  )
}
