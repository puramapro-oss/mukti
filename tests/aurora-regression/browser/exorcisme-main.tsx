import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import ExorcismeFlow from '../../../src/components/exorcisme/ExorcismeFlow'
import './styles.css'

function Harness() {
  const [destination, setDestination] = useState<string | null>(null)
  useEffect(() => {
    const navigate = (event: Event) => setDestination((event as CustomEvent<string>).detail)
    window.addEventListener('mukti-test:navigate', navigate)
    return () => window.removeEventListener('mukti-test:navigate', navigate)
  }, [])
  return <>{destination ? <main data-testid="navigation-complete" data-destination={destination}>Retour demandé au routeur simulé.</main>
    : <ExorcismeFlow />}<Toaster richColors /></>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>)
