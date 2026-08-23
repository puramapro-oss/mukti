import { useCallback, useState } from 'react'
import { safeVibrate } from '@/lib/accessibility'
import type { UseExorcismeSessionReturn } from './useExorcismeSession'

function haptic(pattern: number | number[]) {
  void safeVibrate(pattern)
}

export interface UseExorcismeSealingReturn {
  sealing: boolean
  handleSeal: () => void
}

export function useExorcismeSealing(
  exitSession: UseExorcismeSessionReturn['exitSession']
): UseExorcismeSealingReturn {
  const [sealing, setSealing] = useState(false)

  const handleSeal = useCallback(() => {
    setSealing(true)
    haptic([40, 40, 40, 40, 80])
    setTimeout(() => {
      void exitSession('completed', true)
    }, 600)
  }, [exitSession])

  return {
    sealing,
    handleSeal,
  }
}
