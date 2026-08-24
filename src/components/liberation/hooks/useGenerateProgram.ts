import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Phase = 'idle' | 'initializing' | 'streaming' | 'persisting' | 'done' | 'error'

interface SSEDone {
  program_id: string
  version: number
  summary: {
    phases: number
    micro_meditations: number
    affirmations: number
    plants: number
    anti_pulsion_actions: number
    hypnose_scripts: number
  }
  intention: string
}

export function useGenerateProgram(addictionId: string) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [chars, setChars] = useState(0)
  const [outputTokens, setOutputTokens] = useState(0)
  const [status, setStatus] = useState<string>('')

  const startGeneration = async () => {
    setPhase('initializing')
    setStatus('Connexion à Opus 4.7…')
    setChars(0)
    setOutputTokens(0)

    try {
      const res = await fetch('/api/program/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addiction_id: addictionId }),
      })

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(errJson?.error ?? 'Impossible de lancer la génération.')
        setPhase('error')
        return
      }

      if (!res.body) {
        toast.error('Stream non disponible — réessaie.')
        setPhase('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          if (!chunk.trim()) continue
          const lines = chunk.split('\n')
          const eventLine = lines.find(l => l.startsWith('event:'))
          const dataLine = lines.find(l => l.startsWith('data:'))
          if (!eventLine || !dataLine) continue

          const eventName = eventLine.slice(6).trim()
          const dataStr = dataLine.slice(5).trim()
          let data: unknown
          try {
            data = JSON.parse(dataStr)
          } catch {
            continue
          }

          if (eventName === 'status' && data && typeof data === 'object') {
            const d = data as { phase?: string; message?: string }
            if (d.phase === 'initializing' || d.phase === 'streaming' || d.phase === 'persisting') {
              setPhase(d.phase)
            }
            if (d.message) setStatus(d.message)
          } else if (eventName === 'progress' && data && typeof data === 'object') {
            const d = data as { chars?: number }
            if (typeof d.chars === 'number') setChars(d.chars)
          } else if (eventName === 'usage' && data && typeof data === 'object') {
            const d = data as { output_tokens?: number }
            if (typeof d.output_tokens === 'number') setOutputTokens(d.output_tokens)
          } else if (eventName === 'done') {
            const d = data as SSEDone
            setPhase('done')
            toast.success(
              `Programme v${d.version} généré — ${d.summary.micro_meditations} micro-méditations, ${d.summary.affirmations} affirmations.`,
              { duration: 6000 }
            )
            router.refresh()
          } else if (eventName === 'error' && data && typeof data === 'object') {
            const d = data as { message?: string }
            toast.error(d.message ?? 'Erreur pendant la génération.')
            setPhase('error')
          }
        }
      }
    } catch {
      toast.error('Connexion perdue pendant la génération — réessaie.')
      setPhase('error')
    }
  }

  const isGenerating = phase === 'initializing' || phase === 'streaming' || phase === 'persisting'

  return {
    phase,
    status,
    chars,
    outputTokens,
    isGenerating,
    startGeneration,
  }
}
