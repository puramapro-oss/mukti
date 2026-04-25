// MUKTI G8.6 — Sous-page admin Wording : 6 sections + mode JSON brut

import { getWordingBank } from '@/lib/admin-settings'
import { WORDING_BANK_SECTIONS } from '@/lib/constants'
import WordingEditor from './WordingEditor'

export const dynamic = 'force-dynamic'

export default async function AdminWordingPage() {
  const bank = await getWordingBank()
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Wording bank</h1>
        <p className="text-sm text-white/60">
          6 sections structurées (greetings, errors, success, cta, faq, meta). Chaque entrée = clé / texte. Le bouton{' '}
          <span className="font-medium text-white/85">Mode JSON brut</span> permet d&apos;éditer directement le JSON pour les cas avancés.
        </p>
      </header>
      <WordingEditor initialBank={bank} sections={WORDING_BANK_SECTIONS} />
    </div>
  )
}
