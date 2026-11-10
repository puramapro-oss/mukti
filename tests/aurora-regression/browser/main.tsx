import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuroraSessionFull from '@/components/aurora/AuroraSessionFull'
import './style.css'

// Local test instrumentation, never imported by the application. The analyser
// observes the REAL master gain without replacing Web Audio or the clock.
const NativeAudioContext = window.AudioContext
const contexts: ObservedAudioContext[] = []
class ObservedAudioContext extends NativeAudioContext {
  analyser: AnalyserNode | null = null
  private firstGain = true
  constructor() { super(); contexts.push(this) }
  createGain() {
    const gain = super.createGain()
    if (this.firstGain) {
      this.firstGain = false
      this.analyser = super.createAnalyser()
      this.analyser.fftSize = 2048
      gain.connect(this.analyser)
    }
    return gain
  }
}
window.AudioContext = ObservedAudioContext
Object.assign(window, {
  __auroraProbe: {
    contexts: () => contexts.length,
    rms: () => Math.max(0, ...contexts.map((context) => {
      if (!context.analyser || context.state !== 'running') return 0
      const values = new Float32Array(context.analyser.fftSize)
      context.analyser.getFloatTimeDomainData(values)
      return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
    })),
    states: () => contexts.map((context) => context.state),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0F] text-white">
      <header className="absolute left-0 right-0 top-0 z-30 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs tracking-widest">AURORA</span>
          <div className="text-right"><div className="text-2xl font-light text-teal-200">CALM</div><div className="text-xs text-white/50">Guidage AURORA</div></div>
        </div>
      </header>
      <AuroraSessionFull variant="calm" />
      <footer className="absolute bottom-0 left-0 right-0 z-30 pb-6 text-center">
        <p className="mx-auto max-w-md px-6 text-[11px] leading-relaxed text-white/40">Pas d’hyperventilation ni de rétention prolongée. En cas d’inconfort, arrête et respire naturellement.</p>
      </footer>
    </main>
  </StrictMode>,
)
