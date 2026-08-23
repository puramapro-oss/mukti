import { Users, Clock } from 'lucide-react'
import {
  CIRCLE_ROTATION_MODES,
  CIRCLE_DURATION_PRESETS_SEC,
  type CircleRotationMode,
} from '@/lib/constants'
import { PARTICIPANT_PRESETS } from './types'

interface Step2Props {
  title: string
  description: string
  maxParticipants: number
  customParticipants: string
  duration: number
  rotationMode: CircleRotationMode
  audioMode: 'mesh' | 'sfu'
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeMax: (v: number) => void
  onChangeCustom: (v: string) => void
  onChangeDuration: (v: number) => void
  onChangeRotation: (v: CircleRotationMode) => void
}

export default function Step2(props: Step2Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Les paramètres du cercle</h2>
        <p className="mt-1 text-sm text-white/55">Taille, durée par personne, rotation.</p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="circle-title">
          Titre du cercle
        </label>
        <input
          id="circle-title"
          type="text"
          maxLength={120}
          value={props.title}
          onChange={(e) => props.onChangeTitle(e.target.value)}
          placeholder="Ex. Soir doux pour les âmes fatiguées"
          data-testid="wizard-title"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="circle-desc">
          Description <span className="text-white/30">(optionnel)</span>
        </label>
        <textarea
          id="circle-desc"
          maxLength={600}
          rows={3}
          value={props.description}
          onChange={(e) => props.onChangeDescription(e.target.value)}
          placeholder="Quelques mots pour donner envie de rejoindre…"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
          <Users className="h-3.5 w-3.5" /> Participants max
        </label>
        <div className="flex flex-wrap gap-2">
          {PARTICIPANT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => props.onChangeMax(n)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                props.maxParticipants === n && !props.customParticipants
                  ? 'border-[var(--cyan)]/60 bg-[var(--cyan)]/10 text-[var(--cyan)]'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            min={2}
            max={5000}
            value={props.customParticipants}
            onChange={(e) => props.onChangeCustom(e.target.value)}
            placeholder="Custom…"
            className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-white/40">
          Audio {props.audioMode === 'mesh' ? 'direct peer-to-peer (≤ 8 personnes)' : 'serveur relais scalable (> 8 personnes)'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
          <Clock className="h-3.5 w-3.5" /> Durée par personne
        </label>
        <div className="flex flex-wrap gap-2">
          {CIRCLE_DURATION_PRESETS_SEC.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => props.onChangeDuration(sec)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                props.duration === sec
                  ? 'border-[var(--purple)]/60 bg-[var(--purple)]/10 text-[var(--purple)]'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {sec / 60} min
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60">Mode de rotation</label>
        <div className="grid grid-cols-3 gap-2">
          {CIRCLE_ROTATION_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => props.onChangeRotation(m.id as CircleRotationMode)}
              className={`rounded-xl border p-3 text-left text-xs transition-all ${
                props.rotationMode === m.id
                  ? 'border-white/30 bg-white/[0.06]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <p className="font-medium text-white/90">{m.name}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
