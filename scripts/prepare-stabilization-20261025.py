from pathlib import Path
import hashlib
import json
import re

root = Path.cwd()
changed = set()
def write(path, content):
    dest = root / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding='utf-8')
    changed.add(path)
def replace(path, old, new, count=1):
    text=(root/path).read_text()
    if text.count(old) != count:
        raise RuntimeError(f'Unexpected source for {path}: expected {count} occurrence(s)')
    write(path,text.replace(old,new))
def remove(path):
    (root/path).unlink()
    changed.add(path)

p=json.loads((root/'package.json').read_text())
assert p['devDependencies']['@purama/eslint-config']=='file:../packages/eslint-config-purama'
assert hashlib.sha256((root/'config/eslint/purama.mjs').read_bytes()).hexdigest()=='987fcb95af879ce9c793bd9a865363dd229d64d9004c756be3d2a98046f4d9d6'
del p['devDependencies']['@purama/eslint-config']
write('package.json', json.dumps(p,ensure_ascii=False,indent=2)+'\n')
replace('eslint.config.mjs','import puramaConfig from "@purama/eslint-config";','import puramaConfig from "./config/eslint/purama.mjs";')

write('src/components/reprogrammation/useNightPlayerVolume.ts', '''// MUKTI — NightPlayer active clock. Callback changes must not restart the session.
import { useEffect, useRef, useState } from 'react'
import { computeRampVolume } from '@/lib/reprogramming-utils'
import { REPROG_NIGHT_VOLUME_RAMP_MIN } from '@/lib/constants'

interface UseNightPlayerVolumeParams {
  running: boolean
  rampEnabled: boolean
  onVolumeChange: (vol: number) => void
  onAutoStop: () => void
}

interface UseNightPlayerVolumeReturn {
  volumePct: number
  elapsedSec: number
  rampProgress: number
  rampRemainingSec: number
}

export function useNightPlayerVolume({
  running, rampEnabled, onVolumeChange, onAutoStop,
}: UseNightPlayerVolumeParams): UseNightPlayerVolumeReturn {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [volumePct, setVolumePct] = useState(0.5)
  const latest = useRef({ rampEnabled, onVolumeChange, onAutoStop })

  useEffect(() => {
    latest.current = { rampEnabled, onVolumeChange, onAutoStop }
  }, [rampEnabled, onVolumeChange, onAutoStop])

  useEffect(() => {
    if (!running) {
      setElapsedSec(0)
      return
    }
    const startedAt = performance.now()
    let active = true
    let frame: number | null = null

    function tick() {
      frame = null
      if (!active) return
      const elapsed = Math.max(0, (performance.now() - startedAt) / 1000)
      const current = latest.current
      const finished = current.rampEnabled && elapsed >= REPROG_NIGHT_VOLUME_RAMP_MIN * 60
      const volume = current.rampEnabled ? computeRampVolume(elapsed, 0.55) : 0.45
      setElapsedSec(elapsed)
      setVolumePct(volume)
      // Finish before calling external callbacks: a re-entrant callback cannot
      // schedule another frame or trigger completion twice.
      if (finished) active = false
      try {
        current.onVolumeChange(volume)
      } finally {
        if (finished) current.onAutoStop()
      }
      if (active) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [running])

  const limit = REPROG_NIGHT_VOLUME_RAMP_MIN * 60
  return {
    volumePct,
    elapsedSec,
    rampProgress: Math.min(1, elapsedSec / limit),
    rampRemainingSec: Math.max(0, limit - elapsedSec),
  }
}
''')

write('src/components/exorcisme/hooks/useExorcismePhase.ts', '''import { useCallback, useEffect, useRef, useState } from 'react'
import { EXORCISME_PHASES, type ExorcismePhaseName } from '@/lib/exorcisme-utils'

type PhaseMs = Partial<Record<ExorcismePhaseName, number>>

export interface UseExorcismePhaseReturn {
  phase: ExorcismePhaseName
  phaseMsRef: React.MutableRefObject<PhaseMs>
  startTsRef: React.MutableRefObject<number>
  goToPhase: (next: ExorcismePhaseName) => void
  snapshotPhaseDurations: (now?: number) => PhaseMs
}

export function useExorcismePhase(): UseExorcismePhaseReturn {
  const [phase, setPhase] = useState<ExorcismePhaseName>('invocation')
  const phaseRef = useRef<ExorcismePhaseName>('invocation')
  const initializedRef = useRef(false)
  const startTsRef = useRef(0)
  const phaseStartRef = useRef(0)
  const phaseMsRef = useRef<PhaseMs>({})

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const now = performance.now()
      startTsRef.current = now
      phaseStartRef.current = now
    }
  }, [])

  const goToPhase = useCallback((next: ExorcismePhaseName) => {
    const previous = phaseRef.current
    if (next === previous) return
    const now = performance.now()
    phaseMsRef.current[previous] = (phaseMsRef.current[previous] ?? 0) +
      Math.max(0, Math.round(now - phaseStartRef.current))
    phaseStartRef.current = now
    phaseRef.current = next
    // State updater functions remain pure, including in React StrictMode.
    setPhase(next)
  }, [])

  const snapshotPhaseDurations = useCallback((now = performance.now()): PhaseMs => {
    if (!initializedRef.current) return {}
    const current = phaseRef.current
    return {
      ...phaseMsRef.current,
      [current]: (phaseMsRef.current[current] ?? 0) +
        Math.max(0, Math.round(now - phaseStartRef.current)),
    }
  }, [])

  useEffect(() => {
    if (phase !== 'invocation' && phase !== 'reprogrammation') return
    const duration = EXORCISME_PHASES.find(p => p.name === phase)?.duration_ms
    if (duration === null || duration === undefined) return
    const next = phase === 'invocation' ? 'revelation' : 'scellement'
    const timer = setTimeout(() => goToPhase(next), duration)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  return { phase, phaseMsRef, startTsRef, goToPhase, snapshotPhaseDurations }
}
''')
replace('src/components/exorcisme/hooks/useExorcismeSession.ts',
        "import { sanitizePossessionText, type ExorcismePhaseName } from '@/lib/exorcisme-utils'",
        "import { sanitizePossessionText } from '@/lib/exorcisme-utils'")
replace('src/components/exorcisme/hooks/useExorcismeSession.ts',
        "type PhaseMs = Partial<Record<ExorcismePhaseName, number>>\n\n", '')
replace('src/components/exorcisme/hooks/useExorcismeSession.ts',
        '''      // Close current phase
      phaseData.phaseMsRef.current[phaseData.phase] = Math.max(
        0,
        Math.round(now - phaseData.startTsRef.current)
      )''',
        '''      // Read a snapshot; do not overwrite the current phase with total session time.
      const phasesMs = phaseData.snapshotPhaseDurations(now)''')
replace('src/components/exorcisme/hooks/useExorcismeSession.ts',
        'phases_ms: phaseData.phaseMsRef.current,', 'phases_ms: phasesMs,')
replace('src/components/exorcisme/hooks/useExorcismeSession.ts',
        '[phaseData.phase, phaseData.phaseMsRef, phaseData.startTsRef, tapsRef, affirmationFrRef]',
        '[phaseData.snapshotPhaseDurations, phaseData.startTsRef, tapsRef, affirmationFrRef]')
replace('src/components/exorcisme/hooks/useExorcismeDestruction.ts',
        "import { useCallback, useRef, useState } from 'react'", "import { useCallback, useState } from 'react'")
replace('src/components/reprogrammation/NightPlayer.tsx',
        'const { volumePct, elapsedSec, rampProgress, rampRemainingSec }',
        'const { volumePct, rampProgress, rampRemainingSec }')
replace('src/components/reprogrammation/NightPlayer.tsx',
        '    // eslint-disable-next-line react-hooks/exhaustive-deps\n', '')
for path, names in [('src/lib/circles.ts',['CircleAudioMode','CircleParticipantRole']),
                    ('src/lib/programs.ts',['ProgramPhase','MicroMeditation','PlantInfo','AntiPulsionAction','HypnoseScript'])]:
    text=(root/path).read_text()
    pattern = r'import type \{([^}]+)\} from [\'\"]\./(?:circles|programs)-types[\'\"]'
    match = re.search(pattern,text)
    if not match: raise RuntimeError('Missing type import '+path)
    old=match.group(0); new=old
    for name in names:
        token=f'  {name},\n'
        assert new.count(token)==1
        new=new.replace(token,'')
    write(path,text[:match.start()]+new+text[match.end():])

write('src/lib/ar/mediapipe-loader.ts', '''// MUKTI — MediaPipe lifecycle. No model or camera data leaves this module.
import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import {
  AR_MEDIAPIPE_HAND_MODEL_URL, AR_MEDIAPIPE_POSE_MODEL_URL, AR_MEDIAPIPE_WASM_BASE,
} from '../constants'

export interface MediaPipeEngine {
  pose: PoseLandmarker
  hand: HandLandmarker
  dispose: () => void
}
let pending: Promise<MediaPipeEngine> | null = null

function closeLandmarker(model: { close: () => void }, kind: 'pose' | 'hand') {
  try { model.close() } catch {
    // Report a resource cleanup failure without disclosing camera/user data.
    console.warn(`MediaPipe: échec de libération du module ${kind}.`)
  }
}

async function createEngine(): Promise<MediaPipeEngine> {
  const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(AR_MEDIAPIPE_WASM_BASE)
  const pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: AR_MEDIAPIPE_POSE_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4, outputSegmentationMasks: false,
  })
  let hand: HandLandmarker
  try {
    hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: AR_MEDIAPIPE_HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    })
  } catch (error) {
    closeLandmarker(pose, 'pose')
    throw error
  }
  let disposed = false
  return {
    pose, hand,
    dispose() {
      if (disposed) return
      disposed = true
      closeLandmarker(pose, 'pose')
      closeLandmarker(hand, 'hand')
    },
  }
}

export async function loadMediaPipe(): Promise<MediaPipeEngine> {
  if (typeof window === 'undefined') {
    throw new Error('MediaPipe ne peut être chargé que côté navigateur.')
  }
  if (pending) return pending
  const attempt = createEngine().then(engine => {
    if (pending !== attempt) {
      engine.dispose()
      throw new Error('Chargement MediaPipe annulé par une réinitialisation.')
    }
    return {
      ...engine,
      dispose() {
        if (pending === attempt) pending = null
        engine.dispose()
      },
    }
  })
  pending = attempt
  void attempt.catch(() => {
    if (pending === attempt) pending = null
  })
  return attempt
}

/** Invalidate the current load and release only its own resources. */
export function resetMediaPipe(): void {
  const previous = pending
  pending = null
  if (previous) {
    void previous.then(engine => engine.dispose(), () => undefined)
  }
}
''')

folder='tests/aurora-regression/'
old=(root/(folder+'runtime-regression.cjs')).read_text()
imports="""import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { apiFixture, audioFixture, flush, response } from './runtime-fixtures.mjs'
"""
load_part=old[old.index('function load('):old.index("test('request:")]
load_part=load_part.replace('function load(', 'export function load(').replace('const flush =', 'export const flush =').replace('function apiFixture(', 'export function apiFixture(').replace('const response =','export const response =')
audio_part=old[old.index('class Param {'):old.index("test('audio: silent preparation")]
audio_part=audio_part.replace('function audioFixture(', 'export function audioFixture(').replace('  let context\n','  const contexts = []\n').replace('context = this;','contexts.push(this);').replace('context: () => context,','context: () => contexts.at(-1),')
fixture_head="""/** Test doubles only: no hardware or acoustic calibration. */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const sourceDir = process.env.MUKTI_SOURCE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib')
"""
write(folder+'runtime-fixtures.mjs', fixture_head+'\n'+load_part+'\n'+audio_part)
request_tests=old[old.index("test('request:"):old.index('class Param {')]
audio_tests=old[old.index("test('audio: silent preparation"):]
write(folder+'transport-regression.mjs', imports.replace('apiFixture, audioFixture, flush, response','apiFixture, flush, response')+'\n'+request_tests)
write(folder+'audio-regression.mjs',imports.replace("import { getEventListeners } from 'node:events'\n",'').replace('apiFixture, audioFixture, flush, response','audioFixture')+'\n'+audio_tests)
remove(folder+'runtime-regression.cjs')
s=(root/(folder+'completion-wiring.cjs')).read_text()
for a,b in [("const { test } = require('node:test')","import { test } from 'node:test'"),
            ("const assert = require('node:assert/strict')","import assert from 'node:assert/strict'"),
            ("const fs = require('node:fs')","import fs from 'node:fs'"),
            ("const path = require('node:path')","import path from 'node:path'"),
            ("const vm = require('node:vm')","import vm from 'node:vm'"),
            ("const ts = require('typescript')","import ts from 'typescript'\nimport { fileURLToPath } from 'node:url'"),
            ("path.resolve(__dirname, '../../src/lib')","path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib')")]:
    assert s.count(a)==1; s=s.replace(a,b)
write(folder+'completion-wiring.mjs',s)
remove(folder+'completion-wiring.cjs')

replace('.github/workflows/aurora-regression.yml',
        'node --test runtime-regression.cjs completion-wiring.cjs',
        'node --test transport-regression.mjs audio-regression.mjs completion-wiring.mjs mediapipe-regression.mjs')
replace('.github/workflows/aurora-regression.yml',
        "      - 'src/components/aurora/**'", """      - 'src/components/aurora/**'
      - 'src/components/reprogrammation/**'
      - 'src/components/exorcisme/hooks/**'
      - 'src/lib/ar/mediapipe-loader.ts'
      - 'package.json'
      - 'package-lock.json'""")
replace('.github/workflows/mukti-full-check.yml',
        "      - 'eslint.config.*'", "      - 'eslint.config.*'\n      - 'config/eslint/**'")
write('tests/aurora-regression/stabilization-changes.json',json.dumps(sorted(changed),indent=2)+'\n')
