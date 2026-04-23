'use client'

import { useEffect, useState } from 'react'

export default function CursorGlow() {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window
    if (isTouchDevice) return

    function onMove(e: MouseEvent) {
      setPos({ x: e.clientX, y: e.clientY })
      if (!visible) setVisible(true)
    }

    function onLeave() { setVisible(false) }
    function onEnter() { setVisible(true) }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed z-[9999] h-[300px] w-[300px] rounded-full opacity-[0.07] blur-[80px] transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle, var(--cyan) 0%, transparent 70%)',
        left: pos.x - 150,
        top: pos.y - 150,
      }}
    />
  )
}
