'use client'

// MUKTI G8.7.6 — Settings a11y client : 6 toggles + slider taille texte

import { useAccessibilityPrefs } from '@/hooks/useAccessibilityPrefs'
import { safeVibrate, VIBRATE_PATTERNS, type FontSizePref } from '@/lib/accessibility'
import { ToggleLeft, ToggleRight, VolumeX, Hand, Captions, Eye, Sparkles } from 'lucide-react'

const FONT_SIZES: Array<{ value: FontSizePref; label: string; example: string }> = [
  { value: 'sm', label: 'Petit', example: 'Aa' },
  { value: 'md', label: 'Standard', example: 'Aa' },
  { value: 'lg', label: 'Grand', example: 'Aa' },
  { value: 'xl', label: 'Très grand', example: 'Aa' },
]

interface ToggleRowProps {
  Icon: typeof VolumeX
  label: string
  description: string
  value: boolean
  onChange: () => void
  ariaLabel: string
}

function ToggleRow({ Icon, label, description, value, onChange, ariaLabel }: ToggleRowProps) {
  return (
    <li className={`flex items-start justify-between gap-4 rounded-2xl border p-4 transition ${value ? 'border-cyan-400/30 bg-cyan-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex-shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-white">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/55">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel}
        onClick={onChange}
        className="flex-shrink-0"
      >
        {value ? (
          <ToggleRight className="h-9 w-9 text-cyan-300" aria-hidden="true" />
        ) : (
          <ToggleLeft className="h-9 w-9 text-white/40" aria-hidden="true" />
        )}
      </button>
    </li>
  )
}

export default function AccessibilityClient() {
  const { prefs, setPrefs } = useAccessibilityPrefs()

  function toggle(key: keyof typeof prefs) {
    if (typeof prefs[key] !== 'boolean') return
    setPrefs({ [key]: !prefs[key] })
  }

  function setFontSize(value: FontSizePref) {
    setPrefs({ fontSize: value })
    safeVibrate(VIBRATE_PATTERNS.SHORT)
  }

  function testHaptic() {
    const ok = safeVibrate(VIBRATE_PATTERNS.SUCCESS)
    if (!ok && prefs.hapticEnabled && !prefs.silentMode) {
      // Pas d'API ou refusé — informer
      alert('Ton appareil ne supporte pas les vibrations.')
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        <ToggleRow
          Icon={VolumeX}
          label="Mode silencieux global"
          description="Coupe tous les sons et toutes les vibrations de l'app, instantanément."
          value={prefs.silentMode}
          onChange={() => toggle('silentMode')}
          ariaLabel={`${prefs.silentMode ? 'Désactiver' : 'Activer'} le mode silencieux`}
        />
        <ToggleRow
          Icon={Hand}
          label="Vibrations haptiques"
          description="Retours tactiles pour respiration, rituels, validations. Désactive si gênant."
          value={prefs.hapticEnabled}
          onChange={() => toggle('hapticEnabled')}
          ariaLabel={`${prefs.hapticEnabled ? 'Désactiver' : 'Activer'} les vibrations`}
        />
        <ToggleRow
          Icon={Captions}
          label="Sous-titres visuels forcés"
          description="Affiche INSPIRE / RETIENS / EXPIRE en grand pendant AURORA et Rituel 7s, même sans son."
          value={prefs.captionsForced}
          onChange={() => toggle('captionsForced')}
          ariaLabel={`${prefs.captionsForced ? 'Désactiver' : 'Activer'} les sous-titres visuels`}
        />
        <ToggleRow
          Icon={Sparkles}
          label="Réduire les animations"
          description="Désactive les particules, les pulsations infinies, les transitions douces. Recommandé TDAH, autisme, hypersensibles."
          value={prefs.reducedMotionForced}
          onChange={() => toggle('reducedMotionForced')}
          ariaLabel={`${prefs.reducedMotionForced ? 'Désactiver' : 'Activer'} la réduction d'animations`}
        />
        <ToggleRow
          Icon={Eye}
          label="Contraste élevé"
          description="Augmente la lisibilité des textes secondaires et bordures. Utile vision réduite."
          value={prefs.highContrast}
          onChange={() => toggle('highContrast')}
          ariaLabel={`${prefs.highContrast ? 'Désactiver' : 'Activer'} le contraste élevé`}
        />
      </ul>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-3 text-sm font-medium text-white">Taille du texte</h2>
        <p className="mb-4 text-xs text-white/55">
          Ajuste la taille générale de l&apos;app. Les boutons restent toujours d&apos;au moins 44 px (WCAG AAA).
        </p>
        <div role="radiogroup" aria-label="Taille du texte" className="grid grid-cols-4 gap-2">
          {FONT_SIZES.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={prefs.fontSize === f.value}
              onClick={() => setFontSize(f.value)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 transition ${
                prefs.fontSize === f.value
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.02] text-white/65 hover:border-white/20 hover:text-white'
              }`}
            >
              <span
                className={
                  f.value === 'sm'
                    ? 'text-sm'
                    : f.value === 'lg'
                      ? 'text-lg'
                      : f.value === 'xl'
                        ? 'text-2xl'
                        : 'text-base'
                }
              >
                {f.example}
              </span>
              <span className="text-[10px] uppercase tracking-wide opacity-70">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-3 text-sm font-medium text-white">Tester</h2>
        <button
          type="button"
          onClick={testHaptic}
          className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Vibration test
        </button>
        <p className="mt-2 text-xs text-white/45">
          Si tu ne ressens rien, ton appareil ne supporte peut-être pas les vibrations, ou tu es en mode silencieux.
        </p>
      </div>

      <p className="text-center text-xs text-white/40">
        Tes préférences sont stockées localement sur cet appareil. Elles ne sont jamais envoyées sur nos serveurs.
      </p>
    </div>
  )
}
