import { useEffect } from 'react'
import type { UseExorcismeSessionReturn } from './useExorcismeSession'

export function useExorcismeEscape(exitSession: UseExorcismeSessionReturn['exitSession']) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        void exitSession('interrupted', false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitSession])
}
