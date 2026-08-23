import type { Metadata } from 'next'
import LegalPage from '@/lib/legal/components/LegalPage'
import { buildMentionsLegales } from '@/lib/legal/content/mentions-legales'
import { MUKTI_LEGAL_CONFIG } from '@/lib/legal/config'

export const metadata: Metadata = {
  title: 'Mentions Légales — MUKTI',
  description: 'Mentions légales de MUKTI par SASU PURAMA.',
}

export default function MentionsLegales() {
  return (
    <LegalPage
      titre="Mentions Légales"
      sections={buildMentionsLegales(MUKTI_LEGAL_CONFIG)}
      derniereMiseAJour="23 août 2026"
    />
  )
}
