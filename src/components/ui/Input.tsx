'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={id} className="text-sm text-[var(--text-secondary)]">{label}</label>}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-xl border bg-white/5 px-4 py-3 text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]',
            'focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)]/30',
            error ? 'border-red-500/50' : 'border-[var(--border)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
