// MUKTI — G5.4 NightPlayerRampProgress
// Barre de progression du ramp volume

import { formatTime } from './nightPlayerHelpers'

interface NightPlayerRampProgressProps {
  volumePct: number
  rampProgress: number
  rampRemainingSec: number
  catMetaColor: string
}

export default function NightPlayerRampProgress({
  volumePct,
  rampProgress,
  rampRemainingSec,
  catMetaColor,
}: NightPlayerRampProgressProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/50">
        <span>Ramp volume</span>
        <span>
          {formatTime(rampRemainingSec)} reste · {Math.round(volumePct * 100)}%
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{
            width: `${rampProgress * 100}%`,
            background: catMetaColor,
            transition: 'width 500ms linear',
          }}
        />
      </div>
    </div>
  )
}
