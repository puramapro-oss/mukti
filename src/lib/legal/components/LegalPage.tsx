import type { LegalSection } from '../types';

export interface LegalPageProps {
  titre: string;
  sousTitre?: string;
  sections: LegalSection[];
  derniereMiseAJour: string;
  backHref?: string;
}

/**
 * Rendu générique d'une page légale (mentions/CGU/CGV/confidentialité), adapté aux tokens
 * design MUKTI (glass rounded-3xl, gradient-text, cyan) pour rester cohérent avec le reste
 * de l'app plutôt que les tokens shadcn du socle générique. Les titres ne sont PAS numérotés
 * dans le contenu — ce composant numérote à l'affichage selon l'ordre final du tableau `sections`.
 */
export default function LegalPage({ titre, sousTitre, sections, derniereMiseAJour, backHref = '/' }: LegalPageProps) {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <a href={backHref} className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors">
          ← Retour à l&apos;accueil
        </a>

        <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl mb-2">
          {titre}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-12">{sousTitre ?? `Dernière mise à jour : ${derniereMiseAJour}`}</p>

        <div className="glass rounded-3xl p-8 md:p-12 space-y-10 text-[var(--text-secondary)] leading-relaxed">
          {sections.map((section, i) => (
            <section key={section.titre}>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-4">
                {i + 1}. {section.titre}
              </h2>
              {section.paragraphes.map((p, j) => (
                <p key={j} className="whitespace-pre-line mt-2 first:mt-0">
                  {p}
                </p>
              ))}
              {section.liste && (
                <ul className="mt-3 space-y-1.5 ml-4 list-disc">
                  {section.liste.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
