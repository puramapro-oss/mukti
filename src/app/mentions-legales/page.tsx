import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions Légales — MUKTI',
  description: 'Mentions légales de MUKTI par SASU PURAMA.',
}

export default function MentionsLegales() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl mb-2">
          Mentions Légales
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-12">Dernière mise à jour : 6 avril 2026</p>

        <div className="glass rounded-3xl p-8 md:p-12 space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. Éditeur du site
            </h2>
            <p>Le site <strong className="text-[var(--text-primary)]">mukti.purama.dev</strong> est édité par :</p>
            <ul className="mt-3 space-y-1.5 ml-4">
              <li><strong className="text-[var(--text-primary)]">Dénomination sociale :</strong> SASU PURAMA</li>
              <li><strong className="text-[var(--text-primary)]">Forme juridique :</strong> Société par Actions Simplifiée Unipersonnelle (SASU)</li>
              <li><strong className="text-[var(--text-primary)]">Siège social :</strong> 8 Rue de la Chapelle, 25560 Frasne, France</li>
              <li><strong className="text-[var(--text-primary)]">SIRET :</strong> En cours d&apos;enregistrement (immatriculation récente)</li>
              <li><strong className="text-[var(--text-primary)]">RCS :</strong> En cours d&apos;enregistrement — Tribunal de Commerce de Besançon</li>
              <li><strong className="text-[var(--text-primary)]">Capital social :</strong> 1 000 €</li>
              <li><strong className="text-[var(--text-primary)]">Directeur de la publication :</strong> Matiss Frasne</li>
              <li><strong className="text-[var(--text-primary)]">Contact :</strong> <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline">matiss.frasne@gmail.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. Hébergement
            </h2>
            <p>Le site est hébergé par :</p>
            <ul className="mt-3 space-y-1.5 ml-4">
              <li><strong className="text-[var(--text-primary)]">Hébergeur :</strong> Vercel Inc.</li>
              <li><strong className="text-[var(--text-primary)]">Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
              <li><strong className="text-[var(--text-primary)]">Site web :</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[var(--cyan)] hover:underline">vercel.com</a></li>
            </ul>
            <p className="mt-3">
              Les données de la base de données sont hébergées sur des serveurs situés dans l&apos;Union Européenne.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. Régime fiscal — TVA
            </h2>
            <p>
              SASU PURAMA est soumise au régime de franchise en base de TVA conformément à l&apos;article 293 B du Code Général des Impôts (CGI).
              À ce titre, la TVA n&apos;est pas applicable sur les prestations facturées. La mention <em>« TVA non applicable, art. 293 B du CGI »</em> figure sur toutes les factures émises.
            </p>
            <p className="mt-2">
              Cette franchise s&apos;applique dans le cadre de la Zone de Revitalisation Rurale (ZRR) de la commune de Frasne (25560).
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. Propriété intellectuelle
            </h2>
            <p>
              L&apos;ensemble du contenu présent sur le site mukti.purama.dev (textes, images, graphismes, logo, icônes, code source, architecture) est la propriété exclusive de SASU PURAMA, sauf mention contraire.
            </p>
            <p className="mt-2">
              Toute reproduction, distribution, modification ou utilisation commerciale, totale ou partielle, est strictement interdite sans autorisation écrite préalable de SASU PURAMA.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. Responsabilité
            </h2>
            <p>
              SASU PURAMA s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour régulière des informations présentes sur ce site.
              Toutefois, elle ne peut garantir l&apos;exactitude, la complétude ou l&apos;actualité des informations diffusées.
            </p>
            <p className="mt-2">
              SASU PURAMA ne saurait être tenue responsable de tout dommage direct ou indirect résultant de l&apos;utilisation du site ou des informations qui y sont contenues.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. Contact et médiation
            </h2>
            <p>
              Pour toute question relative aux mentions légales ou à l&apos;utilisation du site, vous pouvez contacter SASU PURAMA à l&apos;adresse :
              <a href="mailto:matiss.frasne@gmail.com" className="text-[var(--cyan)] hover:underline ml-1">matiss.frasne@gmail.com</a>
            </p>
            <p className="mt-2">
              En cas de litige et après tentative de résolution amiable, vous pouvez recourir à un médiateur de la consommation. La Commission Européenne met à disposition une plateforme de Règlement en Ligne des Litiges (RLL) accessible sur <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[var(--cyan)] hover:underline">ec.europa.eu/consumers/odr</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
