'use client'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ message = 'Une erreur est survenue', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="text-[var(--text-secondary)]">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-xl bg-[var(--cyan)]/10 px-4 py-2 text-sm text-[var(--cyan)] transition hover:bg-[var(--cyan)]/20">
          Reessayer
        </button>
      )}
    </div>
  )
}
