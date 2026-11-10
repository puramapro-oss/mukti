import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import AuroraSessionFull from '../../../src/components/aurora/AuroraSessionFull'
import MentalJournalRecorder from '../../../src/components/mode20/MentalJournalRecorder'
import MinimalHabitsList from '../../../src/components/mode19/MinimalHabitsList'
import MysteryChest from '../../../src/components/mode18/MysteryChest'
import WellbeingCheckin from '../../../src/components/wellbeing/WellbeingCheckin'
import WellbeingFeedback from '../../../src/components/wellbeing/WellbeingFeedback'
import { habitStatuses, legacyJournal, recognitionOverview, TODAY, ZONE } from './fixtures'
import { installAuroraProbe } from './aurora-probe'
import './styles.css'

const view = new URLSearchParams(window.location.search).get('view') ?? 'journal'
if (view === 'aurora') installAuroraProbe()
const component = view === 'minimal'
  ? <MinimalHabitsList initialStatus={habitStatuses()} initialDay={TODAY} timeZone={ZONE} />
  : view === 'recognition' ? <MysteryChest initialOverview={recognitionOverview()} />
    : view === 'wellbeing' ? <div className="space-y-6"><WellbeingCheckin /><WellbeingFeedback /></div>
      : <MentalJournalRecorder initialEntries={[legacyJournal]} />
createRoot(document.getElementById('root')!).render(
  view === 'aurora' ? <StrictMode>
    <main data-testid="browser-harness" className="relative min-h-screen overflow-hidden bg-[#0A0A0F] text-white">
      <header className="absolute left-0 right-0 top-0 z-30 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs tracking-widest">AURORA</span>
          <div className="text-right"><div className="text-2xl font-light text-teal-200">CALM</div><div className="text-xs text-white/50">Guidage AURORA</div></div>
        </div>
      </header>
      <AuroraSessionFull variant="calm" />
      <footer className="relative z-30 pb-6 text-center">
        <p className="mx-auto max-w-md px-6 text-[11px] leading-relaxed text-white/40">Respire sans forcer. Si tu ressens des vertiges ou un inconfort, arrête le guidage et reprends une respiration naturelle.</p>
      </footer>
    </main>
  </StrictMode> : <main data-testid="browser-harness" className="mx-auto min-h-screen max-w-4xl space-y-6 bg-[#0A0A0F] p-6 text-white">
    <header><h1 className="text-xl font-semibold">Qualification locale MUKTI</h1><p className="text-sm text-white/65">Données synthétiques · API simulées · aucun compte connecté</p></header>
    {component}<Toaster richColors />
  </main>,
)
