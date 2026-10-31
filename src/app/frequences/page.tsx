import type { Metadata } from 'next'
import ToneStation from '@/components/signals/ToneStation'

export const metadata: Metadata = {
  title: 'MUKTI — Tonalités partagées',
  description: 'Tonalités audibles générées localement, sans microphone. Partage de paramètres uniquement.',
  robots: { index: false, follow: false },
}

export default function FrequenciesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-12 text-white">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-white/60">MUKTI · Portable et Salon · logiciel commun</p>
        <h1 className="text-3xl font-semibold">Tonalités partagées</h1>
        <p className="text-white/70">Choisis une tonalité audible et une durée, puis démarre volontairement. Sans achat d’antenne et sans flux de conversation.</p>
      </header>
      <ToneStation />
      <aside className="space-y-2 rounded-xl border border-white/15 p-5 text-sm text-white/65">
        <p>Prototype logiciel : génération sonore locale uniquement. Ce n’est pas une transmission de l’énergie d’un appareil distant.</p>
        <p>Les ultrasons et accessoires corporels ne sont pas activés : ils nécessitent un matériel identifié et qualifié. Aucun soin, diagnostic, effet de purification ou bénéfice médical n’est démontré par cette tonalité.</p>
      </aside>
    </div>
  )
}
