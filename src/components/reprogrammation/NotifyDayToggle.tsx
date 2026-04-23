'use client'

// MUKTI — G5.5 NotifyDayToggle
// Toggle opt-in simple : persiste dans profiles.notifs.reprog_day_reminders (JSONB).
// Propage via PATCH /api/reprogramming/notifs-preferences.

import { useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NotifyDayToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    const next = !enabled
    setSaving(true)
    // Optimistic update
    setEnabled(next)
    try {
      const resp = await fetch('/api/reprogramming/notifs-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reprog_day_reminders: next }),
      })
      if (!resp.ok) {
        setEnabled(!next)
        const { error } = await resp.json().catch(() => ({ error: null }))
        toast.error(error ?? 'Impossible de sauvegarder.')
        return
      }
      toast.success(
        next
          ? 'Rappels activés. Tu recevras 6 petits rappels de 9h à 19h (UTC). 🌞'
          : 'Rappels désactivés. Tu reviens quand tu veux.'
      )
    } catch {
      setEnabled(!next)
      toast.error('Connexion perdue — réessaie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
            enabled
              ? 'bg-gradient-to-br from-[#F59E0B]/30 to-[#F59E0B]/10'
              : 'bg-white/[0.04]'
          }`}
        >
          {enabled ? (
            <Bell className="h-4 w-4 text-[#F59E0B]" />
          ) : (
            <BellOff className="h-4 w-4 text-white/50" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-white">Rappels 2h (9h–19h UTC)</div>
          <div className="text-xs text-white/60">
            Opt-in. 6 notifs douces max / jour. Désactivable à tout moment.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        aria-label="Activer ou désactiver les rappels Mode Journée"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          enabled ? 'bg-[#F59E0B]' : 'bg-white/10'
        }`}
      >
        {saving ? (
          <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />
        ) : (
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        )}
      </button>
    </div>
  )
}
