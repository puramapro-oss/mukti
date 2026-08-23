import type { Metadata } from 'next'
import LegalPage from '@/lib/legal/components/LegalPage'
import { buildCGU } from '@/lib/legal/content/cgu'
import { MUKTI_LEGAL_CONFIG } from '@/lib/legal/config'

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — MUKTI",
  description: 'CGU de MUKTI par SASU PURAMA.',
}

export default function CGU() {
  return (
    <LegalPage
      titre="Conditions Générales d'Utilisation"
      sections={buildCGU(MUKTI_LEGAL_CONFIG)}
      derniereMiseAJour="23 août 2026"
    />
  )
}
