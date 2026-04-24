'use client'

// MUKTI — COREJoinButton : bouton rejoindre/quitter avec toast.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, LogIn, LogOut } from 'lucide-react'

interface Props {
  eventId: string
  initialJoined: boolean
}

export default function COREJoinButton({ eventId, initialJoined }: Props) {
  const [joined, setJoined] = useState(initialJoined)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function toggle() {
    startTransition(async () => {
      const action = joined ? 'leave' : 'join'
      try {
        const res = await fetch(`/api/core/events/${eventId}/${action}`, {
          method: 'POST',
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Action impossible.')
          return
        }
        setJoined(!joined)
        toast.success(joined ? 'Tu as quitté l\'événement.' : 'Tu as rejoint — présent·e au Moment Z.')
        router.refresh()
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      data-testid="core-join-button"
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        joined
          ? 'border border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]'
          : 'bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] text-white shadow-[0_8px_40px_-12px_rgba(124,58,237,0.6)] hover:shadow-[0_8px_40px_-6px_rgba(124,58,237,0.8)]'
      }`}
    >
      {joined ? (
        <>
          <LogOut className="h-4 w-4" /> Quitter
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4" /> Rejoindre
        </>
      )}
      {!joined && <Users className="h-4 w-4 opacity-80" />}
    </button>
  )
}
