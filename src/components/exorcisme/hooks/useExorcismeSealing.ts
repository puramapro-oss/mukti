import { useCallback, useEffect, useRef, useState } from 'react'
import { safeVibrate } from '@/lib/accessibility'
import type { UseExorcismeSessionReturn } from './useExorcismeSession'

export interface UseExorcismeSealingReturn { sealing: boolean; handleSeal: () => void }

export function useExorcismeSealing(
  exitSession: UseExorcismeSessionReturn['exitSession'], active = true,
): UseExorcismeSealingReturn {
  const [sealing, setSealing] = useState(false)
  const mounted = useRef(false)
  const started = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestExit = useRef(exitSession)
  useEffect(() => { latestExit.current = exitSession }, [exitSession])
  useEffect(() => {
    mounted.current = active
    return () => {
      mounted.current = false
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
  }, [active])

  const handleSeal = useCallback(() => {
    if (!active || !mounted.current || started.current) return
    started.current = true
    setSealing(true)
    void safeVibrate([40, 40, 40, 40, 80])
    timer.current = setTimeout(() => {
      timer.current = null
      if (mounted.current) void latestExit.current('completed', true)
    }, 600)
  }, [active])

  return { sealing, handleSeal }
}
