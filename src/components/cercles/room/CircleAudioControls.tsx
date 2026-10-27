'use client'

import { useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import AudioMeshEngine from './AudioMeshEngine'
import AudioSFUEngine from './AudioSFUEngine'
import CircleListeningPanel from './CircleListeningPanel'

interface CircleAudioControlsProps {
  circleId: string
  myUserId: string
  hasJoined: boolean
  useSFU: boolean
  micMuted: boolean
  onMicMuted: (muted: boolean) => void
  onSpeakingChange: (userId: string, speaking: boolean) => void
  onError: (message: string) => void
}

/** Listening and conversation are explicit choices; neither starts on page load. */
export default function CircleAudioControls(props: CircleAudioControlsProps) {
  const [conversation, setConversation] = useState(false)
  const [ready, setReady] = useState(false)
  if (!props.hasJoined) return <p className="text-xs text-white/60">Admission au cercle en cours…</p>

  function chooseConversation(next: boolean) {
    props.onMicMuted(true)
    setReady(false)
    setConversation(next)
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {!conversation && props.useSFU && <CircleListeningPanel key={props.circleId} circleId={props.circleId} />}
      {!conversation ? (
        <button type="button" onClick={() => chooseConversation(true)} className="rounded-lg border border-white/20 px-3 py-2 text-xs">
          Rejoindre la conversation — microphone initialement coupé
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => props.onMicMuted(!props.micMuted)} data-testid="mic-toggle"
            aria-label={props.micMuted ? 'Activer mon microphone' : 'Couper mon microphone'} aria-pressed={!props.micMuted}
            disabled={!ready} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            {props.micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button type="button" onClick={() => chooseConversation(false)} className="rounded-lg border border-white/20 px-3 py-2 text-xs">
            Arrêter la conversation
          </button>
          {!ready && <span className="text-xs text-white/60">Connexion audio…</span>}
        </div>
      )}
      {!conversation && !props.useSFU && (
        <p className="text-xs text-white/60">Ce petit cercle utilise une conversation directe. L’écoute sans microphone nécessite un cercle avec relais SFU.</p>
      )}
      {conversation && (props.useSFU ? (
        <AudioSFUEngine circleId={props.circleId} myUserId={props.myUserId} micMuted={props.micMuted}
          onStreamReady={() => setReady(true)} onSpeakingChange={props.onSpeakingChange} onError={props.onError} />
      ) : (
        <AudioMeshEngine circleId={props.circleId} myUserId={props.myUserId} micMuted={props.micMuted}
          onStreamReady={() => setReady(true)} onSpeakingChange={props.onSpeakingChange} onError={props.onError} />
      ))}
    </div>
  )
}
