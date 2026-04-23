'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatEurosFraction, formatPoints, levelFromXp, getInitials } from '@/lib/utils'

export default function ProfilePage() {
  const { profile, refetch } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  if (!profile) return null

  const lvl = levelFromXp(profile.xp ?? 0)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone: phone || '' }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Profil mis à jour ✅')
      refetch()
    } catch {
      toast.error('Sauvegarde impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="profile-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Profil</h1>
      </header>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] text-xl font-bold text-white">
            {getInitials(profile.full_name ?? profile.email)}
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{profile.full_name ?? profile.email}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {lvl.emoji} {lvl.name} · Niveau {lvl.id}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <Stat label="Total récupéré" value={formatEurosFraction(Number(profile.total_money_recovered ?? 0))} />
          <Stat label="Démarches" value={String(profile.total_demarches_launched ?? 0)} />
          <Stat label="Points" value={formatPoints(profile.purama_points ?? 0)} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Informations</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Nom complet</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ton nom" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Téléphone</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06…" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--text-secondary)]">Email</span>
            <Input value={profile.email} disabled />
          </label>
        </div>
        <Button onClick={save} disabled={saving} className="mt-4">
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Abonnement</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Plan actuel : <strong className="text-[var(--cyan)]">{profile.subscription_plan === 'premium' ? 'Premium' : 'Découverte (gratuit)'}</strong>
        </p>
        {profile.subscription_plan === 'free' && (
          <a
            href="/pricing"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Passer Premium
          </a>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
