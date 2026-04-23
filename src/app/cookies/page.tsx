import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Cookies — MUKTI',
  description: 'Politique de cookies de MUKTI.',
}

export default function Cookies() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl mb-2">
          Politique de Cookies
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-12">Dernière mise à jour : 6 avril 2026</p>

        <div className="glass rounded-3xl p-8 md:p-12 space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. Qu&apos;est-ce qu&apos;un cookie ?
            </h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone, tablette) lors de la visite d&apos;un site web.
              Les cookies permettent de mémoriser des informations sur votre navigation afin d&apos;améliorer votre expérience et de faire fonctionner certaines fonctionnalités.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. Cookies essentiels uniquement
            </h2>
            <p>
              MUKTI utilise <strong className="text-[var(--text-primary)]">exclusivement des cookies essentiels</strong> au bon fonctionnement du service.
              Aucun cookie publicitaire, aucun cookie de tracking tiers, aucun cookie de profilage n&apos;est utilisé.
            </p>
            <p className="mt-3">
              Ces cookies sont strictement nécessaires et ne nécessitent pas votre consentement préalable au sens de l&apos;article 82 de la loi Informatique et Libertés.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. Liste des cookies utilisés
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 pr-4 text-[var(--text-primary)] font-semibold">Nom</th>
                    <th className="text-left py-3 pr-4 text-[var(--text-primary)] font-semibold">Finalité</th>
                    <th className="text-left py-3 pr-4 text-[var(--text-primary)] font-semibold">Durée</th>
                    <th className="text-left py-3 text-[var(--text-primary)] font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-[var(--cyan)]">sb-auth-token</td>
                    <td className="py-3 pr-4">Session d&apos;authentification Supabase</td>
                    <td className="py-3 pr-4">Session / 30 jours</td>
                    <td className="py-3 text-[var(--green)] text-xs">Essentiel</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-[var(--cyan)]">vida_theme</td>
                    <td className="py-3 pr-4">Préférence de thème (dark/light/oled)</td>
                    <td className="py-3 pr-4">1 an</td>
                    <td className="py-3 text-[var(--green)] text-xs">Essentiel</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-[var(--cyan)]">NEXT_LOCALE</td>
                    <td className="py-3 pr-4">Préférence de langue de l&apos;interface</td>
                    <td className="py-3 pr-4">1 an</td>
                    <td className="py-3 text-[var(--green)] text-xs">Essentiel</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-[var(--cyan)]">vida_cookie_consent</td>
                    <td className="py-3 pr-4">Mémorisation de votre consentement cookies</td>
                    <td className="py-3 pr-4">13 mois</td>
                    <td className="py-3 text-[var(--green)] text-xs">Essentiel</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-[var(--cyan)]">vida_partner_ref</td>
                    <td className="py-3 pr-4">Code de parrainage (attribution)</td>
                    <td className="py-3 pr-4">30 jours</td>
                    <td className="py-3 text-[var(--green)] text-xs">Essentiel</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. Pas de cookies tiers publicitaires
            </h2>
            <p>
              Nous n&apos;utilisons pas de cookies Google Analytics, Facebook Pixel, ou autres outils de tracking publicitaires.
              Notre outil d&apos;analytique interne (PostHog) est configuré sans cookies, en mode anonymisé, et hébergé en Europe.
            </p>
            <p className="mt-2">
              Nous ne partageons aucune donnée de navigation avec des réseaux publicitaires.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. Gestion et suppression des cookies
            </h2>
            <p>
              Vous pouvez à tout moment gérer ou supprimer les cookies via les paramètres de votre navigateur :
            </p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc">
              <li><strong className="text-[var(--text-primary)]">Chrome :</strong> Paramètres → Confidentialité → Cookies</li>
              <li><strong className="text-[var(--text-primary)]">Firefox :</strong> Options → Vie privée → Cookies</li>
              <li><strong className="text-[var(--text-primary)]">Safari :</strong> Préférences → Confidentialité → Cookies</li>
              <li><strong className="text-[var(--text-primary)]">Edge :</strong> Paramètres → Confidentialité → Cookies</li>
            </ul>
            <p className="mt-3">
              <strong className="text-[var(--text-primary)]">Attention :</strong> la suppression des cookies essentiels peut entraîner une déconnexion et une perte de vos préférences d&apos;interface.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. Contact
            </h2>
            <p>
              Pour toute question relative à notre politique de cookies :
              <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline ml-1">matiss.frasne@gmail.com</a>
            </p>
            <p className="mt-2">
              Voir aussi notre <Link href="/politique-confidentialite" className="text-[var(--cyan)] hover:underline">Politique de Confidentialité</Link>.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
