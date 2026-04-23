'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SettingsPage() {
  const { profile, signOut } = useAuth()
  const [iban, setIban] = useState(profile?.iban ?? '')
  const [saving, setSaving] = useState(false)

  if (!profile) return null

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iban: iban || '' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Sauvegardé ✅')
    } catch {
      toast.error('Erreur sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="settings-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Paramètres</h1>
      </header>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">IBAN</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Pour recevoir tes retraits sur ton compte bancaire.</p>
        <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76..." />
        <Button onClick={save} disabled={saving} className="mt-3">
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Compte</h2>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">{profile.email}</p>
        <Button variant="danger" onClick={signOut}>Se déconnecter</Button>
      </Card>
    </div>
  )
}
