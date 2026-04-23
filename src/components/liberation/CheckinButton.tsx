'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Sun } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

interface Props {
  addictionId: string
  /** Dernière date checkin (ISO) — désactive bouton si < 20h */
  lastCheckinAt: string | null
}

export default function CheckinButton({ addictionId, lastCheckinAt }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  const hoursSince = lastCheckinAt
    ? (Date.now() - new Date(lastCheckinAt).getTime()) / 3600000
    : null
  const alreadyChecked = hoursSince !== null && hoursSince < 20

  const handleClick = async () => {
    if (alreadyChecked || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/streak/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addiction_id: addictionId }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string; milestone_granted?: string | null; incremented?: boolean }
        | null

      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? 'Check-in impossible — réessaie.')
        setSubmitting(false)
        return
      }

      if (json.milestone_granted) {
        toast.success(json.message ?? `🎉 Palier ${json.milestone_granted} atteint !`, { duration: 6000 })
      } else if (json.incremented) {
        toast.success(json.message ?? 'Bravo, jour validé.')
      } else {
        toast(json.message ?? 'Déjà checké aujourd\'hui 🌱')
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('Erreur réseau — vérifie ta connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyChecked) {
    return (
      <Button variant="secondary" size="lg" disabled icon={<Check className="h-4 w-4" />} data-testid="checkin-done">
        Check-in du jour validé
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={handleClick}
      loading={submitting || isPending}
      icon={<Sun className="h-4 w-4" />}
      data-testid="checkin-button"
    >
      Check-in du jour
    </Button>
  )
}
