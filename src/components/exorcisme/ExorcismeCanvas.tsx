'use client'

// MUKTI — G5.7 ExorcismeCanvas wrapper (dynamic ssr:false + fallback reduced-motion).

import dynamic from 'next/dynamic'
import type { ExorcismeCanvasInnerProps } from './ExorcismeCanvasInner'

const Inner = dynamic(() => import('./ExorcismeCanvasInner'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-gradient-to-b from-black via-[#12091E] to-[#1E1B4B]" />
  ),
})

export type { ExorcismeCanvasInnerProps }

export default function ExorcismeCanvas(props: ExorcismeCanvasInnerProps) {
  return <Inner {...props} />
}
