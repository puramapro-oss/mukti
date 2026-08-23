import type { Metadata } from 'next'
import LegalPage from '@/lib/legal/components/LegalPage'
import { buildCGV } from '@/lib/legal/content/cgv'
import { MUKTI_LEGAL_CONFIG } from '@/lib/legal/config'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — MUKTI',
  description: 'CGV de MUKTI par SASU PURAMA.',
}

export default function CGV() {
  return (
    <LegalPage
      titre="Conditions Générales de Vente"
      sections={buildCGV(MUKTI_LEGAL_CONFIG)}
      derniereMiseAJour="23 août 2026"
    />
  )
}
