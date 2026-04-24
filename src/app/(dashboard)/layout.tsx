import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import BottomTabBar from '@/components/layout/BottomTabBar'
import OnboardingFlow from '@/components/shared/OnboardingFlow'
import { Rituel7sProvider } from '@/components/rituel7s/Rituel7sProvider'
import Rituel7sButton from '@/components/rituel7s/Rituel7sButton'
import Rituel7sOverlay from '@/components/rituel7s/Rituel7sOverlay'
import { BoucleUrgenceProvider } from '@/components/boucle-urgence/BoucleUrgenceProvider'
import BoucleUrgenceOverlay from '@/components/boucle-urgence/BoucleUrgenceOverlay'
import { HelpBubble } from '@/components/qa/HelpBubble'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Rituel7sProvider>
      <BoucleUrgenceProvider>
        <div className="min-h-screen">
          <Sidebar />
          <div className="lg:pl-60">
            <Topbar />
            <main className="min-h-[calc(100vh-4rem)] p-4 pb-20 lg:p-8 lg:pb-8">
              {children}
            </main>
          </div>
          <BottomTabBar />
          <OnboardingFlow />
          <Rituel7sButton />
          <Rituel7sOverlay />
          <BoucleUrgenceOverlay />
          <HelpBubble />
        </div>
      </BoucleUrgenceProvider>
    </Rituel7sProvider>
  )
}
