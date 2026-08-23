'use client'

import LegalReacceptanceGate from '@/lib/legal/components/LegalReacceptanceGate'
import type { LegalDocType } from '@/lib/legal/types'

export default function LegalReacceptanceGateClient({ docsEnAttente }: { docsEnAttente: LegalDocType[] }) {
  async function handleAccept(docType: LegalDocType) {
    const res = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType }),
    })
    if (!res.ok) throw new Error('accept_failed')
  }

  return <LegalReacceptanceGate appName="MUKTI" docsEnAttente={docsEnAttente} onAccept={handleAccept} />
}
