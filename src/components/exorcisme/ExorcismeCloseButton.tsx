'use client'

import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  disabled: boolean
}

export default function ExorcismeCloseButton({ onClose, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClose}
      disabled={disabled}
      className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/70 backdrop-blur transition-colors hover:text-white disabled:opacity-50 sm:right-8 sm:top-8"
      aria-label="Quitter la séance"
    >
      <X className="h-5 w-5" />
    </button>
  )
}
