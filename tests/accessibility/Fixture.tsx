import AccessibilityClient from '@/app/(dashboard)/dashboard/profile/accessibility/AccessibilityClient'
import AccessibilityPreferencesRoot from '@/components/shared/AccessibilityPreferencesRoot'
import { useReducedMotion } from '@/hooks/useReducedMotion'
export default function Fixture() {
  const reduced = useReducedMotion()
  return <><AccessibilityPreferencesRoot /><main style={{ maxWidth: '46rem', margin: '1rem auto', padding: '1rem' }}>
    <h1>Accessibilité MUKTI</h1><AccessibilityClient />
    <p id="token-sample" style={{ color: 'var(--text-muted)' }}>Texte avec les couleurs du thème.</p>
    <p id="motion-result" data-reduced={String(reduced)}>Mouvement réduit : {String(reduced)}</p>
    <div id="motion-sample" aria-hidden="true" style={{ animation: 'fixture-motion 2s infinite', width: '1rem', height: '1rem', background: 'var(--cyan)' }} />
    <img id="image-sample" width="40" height="40" alt="Exemple de couleurs" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23d83344'/%3E%3C/svg%3E" />
  </main></>
}
