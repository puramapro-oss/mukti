import {
  CIRCLE_CATEGORIES,
  CIRCLE_GUIDANCE_MODES,
  CIRCLE_ROTATION_MODES,
  type CircleGuidanceMode,
  type CircleRotationMode,
} from '@/lib/constants'
import type { Phrase } from './types'

interface Step5Props {
  category: (typeof CIRCLE_CATEGORIES)[number]
  title: string
  description: string
  maxParticipants: number
  duration: number
  rotationMode: CircleRotationMode
  guidanceMode: CircleGuidanceMode
  selectedPhraseIds: string[]
  phrases: Phrase[]
  startMode: 'now' | 'scheduled'
  scheduledAt: string
  audioMode: 'mesh' | 'sfu'
}

export default function Step5(props: Step5Props) {
  const guidance = CIRCLE_GUIDANCE_MODES.find((g) => g.id === props.guidanceMode)
  const rotation = CIRCLE_ROTATION_MODES.find((r) => r.id === props.rotationMode)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Prêt à ouvrir ?</h2>
        <p className="mt-1 text-sm text-white/55">Vérifie les détails avant de créer le cercle.</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: `${props.category.color}25` }}
        >
          {props.category.emoji}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50">{props.category.name}</p>
          <p className="text-base font-medium text-white">{props.title}</p>
          {props.description && <p className="mt-0.5 text-xs text-white/50 line-clamp-2">{props.description}</p>}
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <RecapItem label="Participants max" value={`${props.maxParticipants}`} />
        <RecapItem label="Durée / personne" value={`${props.duration / 60} min`} />
        <RecapItem label="Rotation" value={rotation?.name ?? props.rotationMode} />
        <RecapItem label="Guidage" value={guidance?.name ?? props.guidanceMode} />
        <RecapItem label="Audio" value={props.audioMode === 'mesh' ? 'Direct (mesh)' : 'Relais (SFU)'} />
        <RecapItem
          label="Ouverture"
          value={
            props.startMode === 'now'
              ? 'Immédiate'
              : new Date(props.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
          }
        />
      </dl>

      {props.selectedPhraseIds.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">
            Phrases sélectionnées ({props.selectedPhraseIds.length})
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-white/70">
            {props.selectedPhraseIds.slice(0, 4).map((id) => {
              const p = props.phrases.find((x) => x.id === id)
              if (!p) return null
              return <li key={id}>« {p.text_fr} »</li>
            })}
            {props.selectedPhraseIds.length > 4 && (
              <li className="text-white/40">… et {props.selectedPhraseIds.length - 4} autre{props.selectedPhraseIds.length - 4 > 1 ? 's' : ''}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function RecapItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-white/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-white/90">{value}</dd>
    </div>
  )
}
