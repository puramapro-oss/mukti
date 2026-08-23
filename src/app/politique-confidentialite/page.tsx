import type { Metadata } from 'next'
import LegalPage from '@/lib/legal/components/LegalPage'
import { buildPolitiqueConfidentialite } from '@/lib/legal/content/politique-confidentialite'
import { MUKTI_LEGAL_CONFIG } from '@/lib/legal/config'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — MUKTI',
  description: 'Politique de confidentialité et protection des données personnelles de MUKTI.',
}

export default function PolitiqueConfidentialite() {
  return (
    <LegalPage
      titre="Politique de Confidentialité"
      sections={buildPolitiqueConfidentialite(MUKTI_LEGAL_CONFIG, process.env)}
      derniereMiseAJour="23 août 2026"
    />
  )
}
