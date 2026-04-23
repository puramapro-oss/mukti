'use client'

import { useCallback, useEffect, useState } from 'react'

export function useSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const toggle = useCallback(() => setOpen(prev => !prev), [])
  const close = useCallback(() => { setOpen(false); setQuery('') }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape' && open) {
        close()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, toggle, close])

  return { open, query, setQuery, toggle, close }
}
