import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import Mode2MultisensorielUltime from '../../../src/components/modes/Mode2MultisensorielUltime'
import Mode3MicroMeditation from '../../../src/components/modes/Mode3MicroMeditation'
import AccessibilityPreferencesRoot from '../../../src/components/shared/AccessibilityPreferencesRoot'
import { installAuroraProbe } from './aurora-probe'
import './styles.css'

installAuroraProbe()
const addictionId = '20000000-0000-4000-8000-000000000012'
const micro = new URLSearchParams(window.location.search).get('mode') === 'micro'
function ModesHarness() {
  const [destination, setDestination] = useState<string | null>(null)
  useEffect(() => {
    const onNavigate = (event: Event) => setDestination((event as CustomEvent<string>).detail)
    window.addEventListener('mukti-test:navigate', onNavigate)
    return () => window.removeEventListener('mukti-test:navigate', onNavigate)
  }, [])
  return <>
    <AccessibilityPreferencesRoot />
    {destination ? <main data-testid="navigation-complete" data-destination={destination}>Retour demandé au routeur simulé.</main>
      : micro ? <Mode3MicroMeditation addictionId={addictionId} affirmation="Une pause choisie, à mon rythme." />
        : <Mode2MultisensorielUltime addictionId={addictionId} />}
    <Toaster richColors />
  </>
}
createRoot(document.getElementById('root')!).render(<StrictMode><ModesHarness /></StrictMode>)
