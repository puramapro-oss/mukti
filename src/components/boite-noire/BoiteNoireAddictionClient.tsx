'use client'

// MUKTI — G5.8 BoiteNoireAddictionClient
// Orchestrateur client : CaptureForm + EntriesList refreshable + PatternPanel.

import { useState } from 'react'
import type { BoiteNoireEntry } from '@/lib/boite-noire'
import BoiteNoireCaptureForm from './BoiteNoireCaptureForm'
import BoiteNoireEntriesList from './BoiteNoireEntriesList'
import BoiteNoirePatternPanel from './BoiteNoirePatternPanel'

interface Props {
  addictionId: string
  addictionName: string
  initialEntries: BoiteNoireEntry[]
}

export default function BoiteNoireAddictionClient({
  addictionId,
  addictionName,
  initialEntries,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [entriesCount, setEntriesCount] = useState(initialEntries.length)

  function handleCaptured() {
    setRefreshKey(k => k + 1)
    // Optimistic bump — le list va se refetch.
    setEntriesCount(c => c + 1)
  }

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 px-6 lg:grid-cols-2">
      <div>
        <BoiteNoireCaptureForm
          addictionId={addictionId}
          addictionName={addictionName}
          onCaptured={handleCaptured}
        />

        <div className="mt-6">
          <BoiteNoirePatternPanel
            addictionId={addictionId}
            entriesCount={entriesCount}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          20 derniers déclencheurs
        </h2>
        <BoiteNoireEntriesList
          addictionId={addictionId}
          refreshKey={refreshKey}
          initialEntries={initialEntries}
        />
      </div>
    </div>
  )
}
