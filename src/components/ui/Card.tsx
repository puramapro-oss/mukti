'use client'

import { useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  spotlight?: boolean
  children: ReactNode
}

export default function Card({ className, spotlight = true, children, ...props }: CardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!spotlight || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    ref.current.style.setProperty('--spotlight-x', `${x}px`)
    ref.current.style.setProperty('--spotlight-y', `${y}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        'glass relative overflow-hidden transition-all duration-300',
        spotlight && 'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(400px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(0,212,255,0.06),transparent_60%)]',
        'hover:border-[var(--border-glow)] hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
