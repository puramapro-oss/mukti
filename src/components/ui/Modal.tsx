'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const hasTitle = Boolean(title?.trim())

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const previousFocus = document.activeElement
    if (!dialog.open) dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={hasTitle ? titleId : undefined}
      aria-label={hasTitle ? undefined : 'Fenêtre de dialogue'}
      aria-modal="true"
      className="fixed inset-0 z-[1000] m-0 flex h-[100dvh] max-h-none w-full max-w-none items-center justify-center bg-transparent p-[12px] backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:p-[16px]"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={cn('glass flex max-h-full min-h-0 w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-2xl p-[16px] sm:p-[24px]', className)}>
        <div className="mb-[12px] flex shrink-0 items-start justify-between gap-[12px]">
          {hasTitle ? <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold text-[var(--text-primary)]">{title}</h2> : null}
          <button ref={closeRef} type="button" aria-label="Fermer" onClick={onClose}
            className="ml-auto flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div role="region" aria-label="Contenu de la fenêtre" tabIndex={0}
          className="min-h-0 min-w-0 overflow-y-auto overscroll-contain [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--cyan)]">
          {children}
        </div>
      </div>
    </dialog>
  )
}
