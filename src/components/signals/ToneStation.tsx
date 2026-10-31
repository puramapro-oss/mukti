'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { decodeToneHash, encodeToneHash, TONE_DURATIONS, TONE_FREQUENCIES, type ToneProgram } from '@/lib/tone-program'
import ToneControls from './ToneControls'

const subscribe = (changed: () => void) => {
  window.addEventListener('hashchange', changed)
  return () => window.removeEventListener('hashchange', changed)
}
const snapshot = () => window.location.hash
const serverSnapshot = () => ''

function Composer({ initial }: { initial: ToneProgram }) {
  const [hz, setHz] = useState(initial.hz)
  const [seconds, setSeconds] = useState(initial.seconds)
  const [share, setShare] = useState('')
  const [copied, setCopied] = useState(false)
  const copyAttempt = useRef(0)
  useEffect(() => () => { copyAttempt.current += 1 }, [])
  const program: ToneProgram = { version: 1, hz, seconds }
  const hash = encodeToneHash(program)
  async function createLink() {
    const attempt = ++copyAttempt.current
    const url = new URL('/frequences', window.location.origin)
    url.hash = hash
    setShare(url.href)
    setCopied(false)
    try { await navigator.clipboard.writeText(url.href); if (copyAttempt.current === attempt) setCopied(true) }
    catch { /* A visible, selectable link remains available without clipboard permission. */ }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Tonalité
          <select aria-label="Tonalité" value={hz} onChange={event => { setHz(Number(event.target.value)); copyAttempt.current += 1; setShare(''); setCopied(false) }} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3">
            {TONE_FREQUENCIES.map(value => <option key={value} value={value}>{value} Hz</option>)}
          </select>
        </label>
        <label className="text-sm">Durée
          <select aria-label="Durée" value={seconds} onChange={event => { setSeconds(Number(event.target.value)); copyAttempt.current += 1; setShare(''); setCopied(false) }} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3">
            {TONE_DURATIONS.map(value => <option key={value} value={value}>{value / 60} minute{value > 60 ? 's' : ''}</option>)}
          </select>
        </label>
      </div>
      <ToneControls key={hash} program={program} />
      <button type="button" onClick={() => { void createLink() }} className="rounded-xl border border-white/25 px-5 py-3">Partager ces paramètres</button>
      {share && <div className="space-y-2">
        <label className="block text-sm">Lien de partage<input aria-label="Lien de partage" readOnly value={share} onFocus={event => event.target.select()} className="mt-2 block w-full rounded-lg bg-black p-3" /></label>
        <p role="status" className="text-sm">{copied ? 'Lien copié.' : 'Sélectionne et copie le lien affiché.'}</p>
      </div>}
      <p className="text-sm text-white/65">Le lien partage uniquement la fréquence et la durée, jamais ton volume. Son ouverture ne lance aucun son. Il ne connecte pas une antenne physique et ne donne accès à aucune conversation.</p>
    </div>
  )
}

export default function ToneStation() {
  const hash = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  let program: ToneProgram
  try { program = decodeToneHash(hash) }
  catch { return <p role="alert" className="rounded-xl border border-red-400/30 p-5">Lien de tonalité invalide. Aucun son lancé. <a href="/frequences" className="underline">Revenir au réglage 432 Hz</a></p> }
  return <Composer key={hash} initial={program} />
}
