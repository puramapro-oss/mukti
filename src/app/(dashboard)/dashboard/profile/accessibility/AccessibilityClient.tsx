'use client'

import { useId, useState } from 'react'
import { useAccessibilityPrefs } from '@/hooks/useAccessibilityPrefs'
import { safeVibrate, VIBRATE_PATTERNS, type AccessibilityPrefs, type FontSizePref } from '@/lib/accessibility'

const FONT_SIZES: Array<{ value: FontSizePref; label: string }> = [
  { value: 'sm', label: 'Petit' }, { value: 'md', label: 'Standard' },
  { value: 'lg', label: 'Grand' }, { value: 'xl', label: 'Très grand' },
]
const PERSISTENCE_MESSAGES = {
  pending: '',
  ready: 'Réglages actuels appliqués.',
  saved: 'Préférence enregistrée dans ce navigateur.',
  temporary: 'Préférences appliquées dans cet onglet. Le navigateur ne permet pas de les conserver après sa fermeture.',
  unavailable: 'Le stockage du navigateur est indisponible. Les réglages visibles restent appliqués dans cet onglet ; leur enregistrement ne peut pas être vérifié.',
}

function PreferenceSwitch({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (value: boolean) => void
}) {
  const id = useId()
  return <div className="mukti-a11y-choice">
    <label htmlFor={id}><span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={value} aria-describedby={id + '-help'}
        onChange={event => onChange(event.target.checked)} />
    </label>
    <p id={id + '-help'}>{description}</p>
  </div>
}

export default function AccessibilityClient() {
  const { prefs, persistence, setPrefs } = useAccessibilityPrefs()
  const [feedback, setFeedback] = useState('')
  const radioName = useId()
  const hapticsEnabled = prefs.hapticEnabled && !prefs.silentMode

  function update(patch: Partial<AccessibilityPrefs>) {
    setPrefs(patch)
    setFeedback('')
  }
  function testHaptic() {
    const accepted = safeVibrate(VIBRATE_PATTERNS.SUCCESS)
    setFeedback(accepted
      ? 'Test demandé à l’appareil. Vérifiez si vous ressentez la vibration.'
      : 'Le test de vibration est indisponible ou refusé sur cet appareil.')
  }

  return <div className="mukti-accessibility-panel">
    <section aria-labelledby={radioName + '-comfort'}>
      <h2 id={radioName + '-comfort'}>Votre confort</h2>
      <PreferenceSwitch label="Vibrations des pratiques"
        description="Autorise les retours tactiles des pratiques qui les proposent. Les sons se règlent dans chaque lecteur."
        value={hapticsEnabled}
        onChange={enabled => update({ hapticEnabled: enabled, silentMode: !enabled })} />
      <PreferenceSwitch label="Réduire les animations"
        description="Réduit les mouvements de l’interface. Le réglage de réduction des animations de votre appareil reste respecté."
        value={prefs.reducedMotionForced}
        onChange={enabled => update({ reducedMotionForced: enabled })} />
      <PreferenceSwitch label="Renforcer les contrastes du thème"
        description="Accentue les textes et les bordures des éléments qui utilisent les couleurs du thème."
        value={prefs.highContrast}
        onChange={enabled => update({ highContrast: enabled })} />
    </section>
    <fieldset className="mukti-a11y-size">
      <legend>Taille du texte</legend>
      <p>Choisissez une taille confortable. Le zoom de votre navigateur reste disponible.</p>
      <div className="mukti-a11y-radios">
        {FONT_SIZES.map(font => <label key={font.value}>
          <input type="radio" name={radioName} value={font.value} checked={prefs.fontSize === font.value}
            onChange={() => update({ fontSize: font.value })} />
          <span>{font.label}</span>
        </label>)}
      </div>
    </fieldset>
    <section aria-labelledby={radioName + '-test'}>
      <h2 id={radioName + '-test'}>Essayer les vibrations</h2>
      <button type="button" onClick={testHaptic} disabled={!hapticsEnabled}>Tester une vibration</button>
      {!hapticsEnabled && <p>Activez les vibrations des pratiques pour essayer.</p>}
    </section>
    <p role="status" aria-live="polite" aria-atomic="true" className="mukti-a11y-status">{[PERSISTENCE_MESSAGES[persistence], feedback].filter(Boolean).join(' ')}</p>
    <p>Ces préférences restent dans ce navigateur. Elles ne sont pas envoyées sur nos serveurs.</p>
  </div>
}
