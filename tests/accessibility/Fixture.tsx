import { StrictMode, useState } from 'react'
import AccessibilityPage from '@/app/(dashboard)/dashboard/profile/accessibility/page'
import AccessibilityPreferencesRoot from '@/components/shared/AccessibilityPreferencesRoot'
import ShareStoryButton from '@/components/shared/ShareStoryButton'
import Modal from '@/components/ui/Modal'
import { useReducedMotion } from '@/hooks/useReducedMotion'

function ModalFixture() {
  const [open, setOpen] = useState<'named' | 'untitled' | null>(null)
  const [closeCount, setCloseCount] = useState(0)
  const [submitCount, setSubmitCount] = useState(0)
  const close = () => { setCloseCount(count => count + 1); setOpen(null) }
  return <section className="mukti-accessibility-panel" aria-labelledby="modal-test-title">
    <h2 id="modal-test-title">Contrôle de la fenêtre partagée</h2>
    <form onSubmit={event => { event.preventDefault(); setSubmitCount(count => count + 1) }}>
      <button type="button" onClick={() => setOpen('named')}>Ouvrir la fenêtre de test</button>
      <button type="button" onClick={() => setOpen('untitled')}>Ouvrir sans titre</button>
      <StrictMode><Modal open={open !== null} onClose={close} title={open === 'named' ? 'Exemple de partage' : undefined}>
        <label htmlFor="modal-test-input">Message de test</label>
        <input id="modal-test-input" className="w-full border border-[var(--border)] bg-[var(--bg-card)] p-2 text-[var(--text-primary)]" />
        <button type="submit">Action de test</button>
      </Modal></StrictMode>
    </form>
    <p id="modal-close-count">Fermetures : {closeCount}</p>
    <p id="modal-submit-count">Actions : {submitCount}</p>
  </section>
}

export default function Fixture() {
  const reduced = useReducedMotion()
  return <><AccessibilityPreferencesRoot /><main>
    <AccessibilityPage />
    <p id="token-sample" style={{ color: 'var(--text-muted)' }}>Texte avec les couleurs du thème.</p>
    <p id="motion-result" data-reduced={String(reduced)}>Mouvement réduit : {String(reduced)}</p>
    <div id="motion-sample" aria-hidden="true" style={{ animation: 'fixture-motion 2s infinite', width: '1rem', height: '1rem', background: 'var(--cyan)' }} />
    <img id="image-sample" width="40" height="40" alt="Exemple de couleurs" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23d83344'/%3E%3C/svg%3E" />
    <ModalFixture />
    <section className="p-[16px]" aria-labelledby="full-share-title">
      <h2 id="full-share-title">Contenu complet de partage</h2>
      <ShareStoryButton type="streak" headline="Une étape à partager" value="Trois jours de pratique"
        label="Ouvrir le partage complet" variant="secondary" />
    </section>
  </main></>
}
