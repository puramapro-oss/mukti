import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — MUKTI',
  description: 'Politique de confidentialité et protection des données personnelles de MUKTI.',
}

export default function PolitiqueConfidentialite() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl mb-2">
          Politique de Confidentialité
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-12">Dernière mise à jour : 6 avril 2026</p>

        <div className="glass rounded-3xl p-8 md:p-12 space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. Qui sommes-nous ?
            </h2>
            <p>
              SASU PURAMA (ci-après &quot;nous&quot;) exploite la plateforme MUKTI accessible à l&apos;adresse <strong className="text-[var(--text-primary)]">mukti.purama.dev</strong>.
              SASU PURAMA est responsable du traitement de vos données personnelles au sens du Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679).
            </p>
            <p className="mt-2">
              Notre Délégué à la Protection des Données (DPO) est joignable à l&apos;adresse : <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline">matiss.frasne@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. Données collectées
            </h2>
            <p>Nous collectons les données suivantes lors de votre utilisation de MUKTI :</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li><strong className="text-[var(--text-primary)]">Données d&apos;identification :</strong> adresse e-mail, nom complet (optionnel), photo de profil (via Google OAuth si utilisé)</li>
              <li><strong className="text-[var(--text-primary)]">Données de situation :</strong> âge, situation familiale, emploi, revenus, logement, handicap, statut frontalier — uniquement renseignées volontairement pour le scanner d&apos;aides</li>
              <li><strong className="text-[var(--text-primary)]">Données d&apos;usage :</strong> historique des scans d&apos;aides, conversations avec MUKTI, démarches générées, missions complétées</li>
              <li><strong className="text-[var(--text-primary)]">Données bancaires de retrait :</strong> IBAN renseigné par l&apos;utilisateur pour les retraits du wallet (chiffré au repos)</li>
              <li><strong className="text-[var(--text-primary)]">Données de paiement :</strong> gérées exclusivement par Stripe (nous ne stockons jamais les numéros de carte)</li>
              <li><strong className="text-[var(--text-primary)]">Données techniques :</strong> adresse IP (anonymisée), type de navigateur, préférences d&apos;interface (thème, langue)</li>
              <li><strong className="text-[var(--text-primary)]">Données d&apos;analytique :</strong> données agrégées et anonymisées sur l&apos;utilisation des fonctionnalités (via PostHog hébergé en Europe)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. Finalités du traitement
            </h2>
            <p>Vos données sont traitées pour les finalités suivantes :</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li>Création et gestion de votre compte utilisateur</li>
              <li>Fourniture des services MUKTI (scanner financier, chat MUKTI, génération et suivi de démarches)</li>
              <li>Traitement des paiements et émission des factures</li>
              <li>Envoi d&apos;emails transactionnels (confirmation de compte, factures, notifications)</li>
              <li>Amélioration continue de nos services (analytique agrégée)</li>
              <li>Prévention des abus et sécurité de la plateforme</li>
              <li>Respect de nos obligations légales et comptables</li>
            </ul>
            <p className="mt-3">
              La base légale du traitement est : l&apos;exécution du contrat (services), le consentement (communications marketing), et l&apos;obligation légale (comptabilité).
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. Durée de conservation
            </h2>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li><strong className="text-[var(--text-primary)]">Données de compte actif :</strong> pendant toute la durée du contrat + 3 ans après clôture du compte</li>
              <li><strong className="text-[var(--text-primary)]">Historique des conversations IA :</strong> 1 an glissant (configurable dans les paramètres)</li>
              <li><strong className="text-[var(--text-primary)]">Données de facturation :</strong> 10 ans conformément aux obligations comptables françaises</li>
              <li><strong className="text-[var(--text-primary)]">Logs de sécurité :</strong> 6 mois</li>
              <li><strong className="text-[var(--text-primary)]">Données analytiques agrégées :</strong> 24 mois</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. Vos droits RGPD
            </h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li><strong className="text-[var(--text-primary)]">Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles</li>
              <li><strong className="text-[var(--text-primary)]">Droit de rectification :</strong> corriger vos données inexactes ou incomplètes</li>
              <li><strong className="text-[var(--text-primary)]">Droit à l&apos;effacement (&quot;droit à l&apos;oubli&quot;) :</strong> demander la suppression de vos données</li>
              <li><strong className="text-[var(--text-primary)]">Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible</li>
              <li><strong className="text-[var(--text-primary)]">Droit d&apos;opposition :</strong> s&apos;opposer à certains traitements (notamment le marketing)</li>
              <li><strong className="text-[var(--text-primary)]">Droit à la limitation :</strong> restreindre le traitement dans certaines circonstances</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, rendez-vous dans <strong className="text-[var(--text-primary)]">Paramètres → Compte → Données personnelles</strong> de votre espace MUKTI, ou contactez notre DPO à : <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline">matiss.frasne@gmail.com</a>.
            </p>
            <p className="mt-2">
              Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[var(--cyan)] hover:underline">cnil.fr</a>).
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. Partage des données
            </h2>
            <p>Vos données peuvent être partagées avec les sous-traitants strictement nécessaires à la fourniture du service :</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li><strong className="text-[var(--text-primary)]">Supabase</strong> — base de données (serveurs EU)</li>
              <li><strong className="text-[var(--text-primary)]">Stripe</strong> — traitement des paiements (certifié PCI-DSS)</li>
              <li><strong className="text-[var(--text-primary)]">Anthropic / OpenAI / Google</strong> — traitement des requêtes IA (sans conservation personnalisée)</li>
              <li><strong className="text-[var(--text-primary)]">Resend</strong> — envoi d&apos;emails transactionnels</li>
              <li><strong className="text-[var(--text-primary)]">Sentry</strong> — monitoring des erreurs (données anonymisées)</li>
            </ul>
            <p className="mt-3">
              Nous ne vendons jamais vos données à des tiers à des fins publicitaires.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              7. Cookies
            </h2>
            <p>
              Nous utilisons uniquement des cookies essentiels au fonctionnement du service (session d&apos;authentification, préférences de langue et de thème).
              Nous n&apos;utilisons pas de cookies publicitaires ou de suivi tiers sans votre consentement explicite.
            </p>
            <p className="mt-2">
              Pour en savoir plus, consultez notre <Link href="/cookies" className="text-[var(--cyan)] hover:underline">Politique Cookies</Link>.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              8. Sécurité
            </h2>
            <p>
              Nous mettons en œuvre des mesures de sécurité adaptées : chiffrement TLS en transit, chiffrement au repos, accès aux données restreint, authentification multi-facteurs pour les accès internes, et audits réguliers.
              En cas de violation de données, nous vous informerons dans les 72 heures conformément au RGPD.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
