import { useState, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TRIGGERS_BY_TYPE, INITIAL_STATE, type FormState } from './types-constants'

export function useAddictionForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [state, setState] = useState<FormState>(INITIAL_STATE)
  const [customTrigger, setCustomTrigger] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const triggerSuggestions = useMemo(
    () => (state.type ? TRIGGERS_BY_TYPE[state.type] : []),
    [state.type],
  )

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return state.type !== null
      case 2:
        return state.severity >= 1 && state.severity <= 5 && (state.type !== 'autre' || state.custom_label.trim().length >= 2)
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  }, [step, state])

  const toggleTrigger = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.includes(trimmed)
        ? prev.triggers.filter(t => t !== trimmed)
        : prev.triggers.length >= 10
          ? prev.triggers
          : [...prev.triggers, trimmed],
    }))
  }

  const addCustomTrigger = () => {
    const trimmed = customTrigger.trim()
    if (!trimmed) return
    if (state.triggers.includes(trimmed)) {
      setCustomTrigger('')
      return
    }
    if (state.triggers.length >= 10) {
      toast.error('10 déclencheurs maximum — tu pourras affiner plus tard.')
      return
    }
    setState(prev => ({ ...prev, triggers: [...prev.triggers, trimmed] }))
    setCustomTrigger('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!state.type || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/addictions/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: state.type,
          severity: state.severity,
          frequency_daily: state.frequency_daily === '' ? undefined : state.frequency_daily,
          started_ago_months: state.started_ago_months === '' ? undefined : state.started_ago_months,
          triggers: state.triggers,
          goal: state.goal,
          custom_label: state.type === 'autre' ? state.custom_label.trim() : undefined,
        }),
      })

      const json = (await res.json().catch(() => null)) as { error?: string; addiction?: { id: string }; message?: string } | null

      if (!res.ok || !json?.addiction) {
        toast.error(json?.error ?? 'Impossible de déclarer ta libération. Réessaie.')
        setSubmitting(false)
        return
      }

      toast.success(json.message ?? 'Ta libération commence maintenant. 🌱')
      router.push(`/dashboard/liberation?new=${json.addiction.id}`)
      router.refresh()
    } catch {
      toast.error('Erreur réseau — vérifie ta connexion.')
      setSubmitting(false)
    }
  }

  return {
    step,
    setStep,
    state,
    setState,
    customTrigger,
    setCustomTrigger,
    submitting,
    triggerSuggestions,
    canAdvance,
    toggleTrigger,
    addCustomTrigger,
    handleSubmit,
  }
}
