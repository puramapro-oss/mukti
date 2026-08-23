import { buildCompanyInfo, buildMediateurInfo } from './company';
import type { LegalAppConfig } from './types';

/**
 * Config légale de MUKTI (socle NIYAMA, packages/legal/README.md). `aPaiement: true`
 * (abonnement Stripe réel, `src/lib/stripe.ts`), `aChatIA: true` (NAMA-Aidant + assistant
 * d'aide, `src/app/api/accompagnants/nama-aidant/route.ts` + `src/app/api/qa/ask/route.ts`).
 */
export const MUKTI_LEGAL_CONFIG: LegalAppConfig = {
  slug: 'mukti',
  nom: 'MUKTI',
  domaine: 'mukti.purama.dev',
  famille: 'karma_wellness',
  company: buildCompanyInfo(),
  mediateur: buildMediateurInfo(),
  descriptionActivite:
    "MUKTI accompagne la libération des dépendances et schémas addictifs par l'intelligence artificielle (détection de schémas, accompagnants IA), des rituels de transformation, un journal mental, des cercles de soutien entre pairs, ainsi qu'un système de missions, de parrainage et de récompenses.",
  aPaiement: true,
  aChatIA: true,
  clausesSpecifiquesCgu: [
    {
      titre: 'Âge minimum et accompagnement',
      paragraphes: [
        'Vous devez avoir au moins 16 ans pour créer un compte MUKTI. Pour les mineurs de moins de 16 ans, le consentement parental est requis.',
        "MUKTI est un outil d'auto-accompagnement (IA, rituels, communauté de pairs) et ne remplace en aucun cas un diagnostic, un suivi médical ou psychologique professionnel. En cas de détresse grave ou de risque pour votre santé, contactez immédiatement un professionnel de santé ou, en France, le 3114 (numéro national de prévention du suicide, gratuit, 24/7).",
      ],
    },
  ],
  clausesSpecifiquesCgv: [
    {
      titre: 'Plans et tarifs',
      paragraphes: ["Les abonnements disponibles sur MUKTI sont :"],
      liste: [
        'Plan Gratuit : 0 €/mois (fonctionnalités de base, accès limité).',
        'Plan Premium mensuel : 9,99 €/mois.',
        'Plan Premium annuel : 83,90 €/an (soit -30 % par rapport au tarif mensuel).',
        "Tout abonnement payant bénéficie d'une période d'essai gratuite de 14 jours avec accès complet aux fonctionnalités Premium.",
      ],
    },
    {
      titre: 'Modalités de paiement',
      paragraphes: [
        'Le paiement est effectué en ligne via la plateforme sécurisée Stripe (carte bancaire, PayPal, Stripe Link). Aucune donnée bancaire n\'est stockée par nos soins.',
        "En cas d'échec de paiement, 3 tentatives supplémentaires sont effectuées avant dégradation du compte au plan Gratuit. Un email de rappel est envoyé 7 jours avant chaque renouvellement annuel.",
      ],
    },
  ],
};
