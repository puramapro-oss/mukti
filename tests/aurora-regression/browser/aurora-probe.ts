// Preserved from the PR #3 browser harness. The analyser observes the REAL
// first/master gain. It never replaces Web Audio, generated sound or the clock.
export function installAuroraProbe() {
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
}
