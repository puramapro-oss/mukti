import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation — MUKTI',
  description: 'CGU de MUKTI par SASU PURAMA.',
}

export default function CGU() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl mb-2">
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-12">Dernière mise à jour : 6 avril 2026</p>

        <div className="glass rounded-3xl p-8 md:p-12 space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. Acceptation des CGU
            </h2>
            <p>
              En accédant et en utilisant la plateforme MUKTI (accessible à <strong className="text-[var(--text-primary)]">mukti.purama.dev</strong>), vous acceptez sans réserve les présentes Conditions Générales d&apos;Utilisation.
              Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser le service.
            </p>
            <p className="mt-2">
              SASU PURAMA se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email ou notification dans l&apos;application. La poursuite de l&apos;utilisation du service vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. Description du service
            </h2>
            <p>
              MUKTI est une plateforme SaaS d&apos;assistance financière et juridique propulsée par MUKTI. Elle permet notamment :
            </p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc">
              <li>Scanner financier IA : détection des aides sociales, crédits d&apos;impôt et droits oubliés (CAF, CPAM, MDPH, Pôle Emploi, retraite, énergie, transport)</li>
              <li>Optimisation fiscale et conventions frontalières (Suisse, Luxembourg, Allemagne, Belgique, Italie, Espagne, Monaco, Andorre)</li>
              <li>Récupération d&apos;argent oublié : comptes dormants Ciclade, assurances vie, trop-perçus, frais bancaires abusifs</li>
              <li>Assistant juridique : courriers de réclamation, mises en demeure, calcul d&apos;indemnités</li>
              <li>Suivi des démarches en temps réel et exécution automatisée</li>
              <li>Wallet, parrainage, missions et concours</li>
            </ul>
            <p className="mt-3">
              Les résultats fournis par MUKTI sont indicatifs et ne se substituent pas à une consultation professionnelle officielle. SASU PURAMA s&apos;efforce d&apos;assurer une disponibilité maximale (objectif SLA 99,5%) mais ne garantit pas une disponibilité ininterrompue.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. Création et gestion du compte
            </h2>
            <p>Pour utiliser MUKTI, vous devez créer un compte en fournissant une adresse e-mail valide. Vous pouvez également vous connecter via votre compte Google.</p>
            <p className="mt-2">Vous êtes responsable :</p>
            <ul className="mt-2 space-y-1.5 ml-4 list-disc">
              <li>De la confidentialité de vos identifiants de connexion</li>
              <li>De toutes les activités effectuées depuis votre compte</li>
              <li>De la mise à jour de vos informations si elles changent</li>
            </ul>
            <p className="mt-2">
              Vous devez avoir au moins 16 ans pour créer un compte. Pour les mineurs de moins de 16 ans, le consentement parental est requis.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. Utilisation acceptable
            </h2>
            <p>En utilisant MUKTI, vous vous engagez à ne pas :</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc">
              <li>Générer, diffuser ou promouvoir du contenu illégal, haineux, violent, pornographique ou discriminatoire</li>
              <li>Utiliser le service pour du spam, du phishing ou toute activité frauduleuse</li>
              <li>Tenter de contourner les limites d&apos;utilisation ou les mesures de sécurité</li>
              <li>Revendre ou redistribuer l&apos;accès au service sans autorisation écrite</li>
              <li>Utiliser le service pour entraîner des modèles d&apos;IA concurrents</li>
              <li>Violer les droits de propriété intellectuelle de tiers</li>
              <li>Usurper l&apos;identité d&apos;une autre personne ou entité</li>
              <li>Utiliser des robots ou scripts automatisés non autorisés pour accéder au service</li>
            </ul>
            <p className="mt-3">
              SASU PURAMA se réserve le droit de suspendre ou supprimer tout compte en violation de ces règles, sans préavis et sans remboursement dans les cas graves.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. Propriété intellectuelle
            </h2>
            <p>
              <strong className="text-[var(--text-primary)]">Contenu de la plateforme :</strong> L&apos;ensemble du code, des interfaces, des marques, des logos et contenus de MUKTI restent la propriété exclusive de SASU PURAMA.
            </p>
            <p className="mt-3">
              <strong className="text-[var(--text-primary)]">Contenu généré :</strong> Les courriers, scans et démarches générés via MUKTI à partir de votre situation vous appartiennent. Vous accordez à SASU PURAMA une licence limitée et strictement nécessaire pour exécuter le service (stockage, affichage, traitement par MUKTI).
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. Responsabilité limitée
            </h2>
            <p>
              MUKTI fournit des outils d&apos;assistance financière et juridique à titre informatif. Les calculs, montants estimés et démarches générés par MUKTI sont fournis à titre indicatif et ne constituent pas un avis juridique, fiscal ou financier professionnel. L&apos;utilisateur reste seul responsable de la vérification de ses droits auprès des organismes compétents.
            </p>
            <p className="mt-2">
              SASU PURAMA ne saurait être tenue responsable des décisions prises sur la base des résultats générés par l&apos;IA. La responsabilité de SASU PURAMA est limitée au montant total des sommes versées par l&apos;utilisateur au cours des 12 derniers mois.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              7. Droit applicable et juridiction
            </h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable. À défaut, les tribunaux compétents seront ceux du ressort du Tribunal de Commerce de Besançon (France), sauf dispositions impératives contraires.
            </p>
            <p className="mt-2">
              Pour les consommateurs résidant dans l&apos;Union Européenne, les dispositions impératives de protection des consommateurs de votre pays de résidence s&apos;appliquent.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              8. Contact
            </h2>
            <p>
              Pour toute question relative aux présentes CGU : <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline">matiss.frasne@gmail.com</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
