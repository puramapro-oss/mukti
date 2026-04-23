export type FaqCategoryId = 'demarrage' | 'scanner' | 'wallet' | 'premium' | 'securite' | 'compte'

export const FAQ_CATEGORIES: { id: FaqCategoryId; label: string; icon: string }[] = [
  { id: 'demarrage', label: 'Démarrage', icon: '🚀' },
  { id: 'scanner', label: 'Scanner & démarches', icon: '🔍' },
  { id: 'wallet', label: 'Wallet & retraits', icon: '💰' },
  { id: 'premium', label: 'Premium', icon: '⭐' },
  { id: 'securite', label: 'Sécurité & RGPD', icon: '🔒' },
  { id: 'compte', label: 'Compte', icon: '👤' },
]

export type FaqItem = {
  id: string
  category: FaqCategoryId
  question: string
  answer: string
  keywords: string[]
}

export const FAQ_ITEMS: FaqItem[] = [
  // ── Démarrage ──────────────────────────────────────────────
  {
    id: 'quest-ce-que-purama-aide',
    category: 'demarrage',
    question: 'Qu\'est-ce que MUKTI ?',
    answer:
      'MUKTI est un scanner financier intelligent qui détecte toutes les aides sociales, optimisations fiscales et argent oublié auxquels tu as droit en France. MUKTI, ton assistante personnelle, calcule les montants exacts en quelques secondes puis lance les démarches pour toi.\n\nEn moyenne, nos utilisateurs récupèrent 1 200 € à 8 000 € la première année selon leur situation.',
    keywords: ['app', 'service', 'aide', 'scanner', 'argent', 'récupérer', 'définition'],
  },
  {
    id: 'inscription-gratuite',
    category: 'demarrage',
    question: 'L\'inscription est-elle gratuite ?',
    answer:
      '✅ Oui, 100 % gratuite. Tu crées ton compte en 30 secondes (email ou Google) et tu peux scanner ta situation immédiatement, sans carte bancaire.\n\nLe plan Free te permet de voir toutes les aides détectées et lancer 5 scans par jour. Le plan Premium (essai 14 jours offerts) lance les démarches automatiquement et débloque le wallet de retrait.',
    keywords: ['gratuit', 'prix', 'inscription', 'créer compte', 'sans cb'],
  },
  {
    id: 'comment-commencer',
    category: 'demarrage',
    question: 'Comment lancer mon premier scan ?',
    answer:
      '1️⃣ Inscris-toi via /signup\n2️⃣ Va dans /scanner\n3️⃣ Réponds aux questions de situation (revenus, logement, famille, emploi…)\n4️⃣ MUKTI analyse ta situation et liste les aides récupérables avec montants exacts\n5️⃣ Clique sur une aide pour voir la démarche officielle et la lancer (Premium)',
    keywords: ['commencer', 'scan', 'premier', 'tutoriel', 'comment'],
  },

  // ── Scanner & démarches ───────────────────────────────────
  {
    id: 'scanner-fiabilite',
    category: 'scanner',
    question: 'Le scanner est-il vraiment fiable ?',
    answer:
      'MUKTI s\'appuie sur les barèmes officiels CAF, CPAM, Pôle Emploi, MDPH, CARSAT, conventions fiscales France-Suisse / Luxembourg / Allemagne / Belgique, et le Code général des impôts à jour.\n\nLes montants affichés sont des estimations précises basées sur ta situation déclarée. Le montant exact sera confirmé après simulation officielle sur le site de l\'organisme. Si tu déclares des infos approximatives, l\'estimation l\'est aussi.',
    keywords: ['fiable', 'précis', 'exact', 'confiance', 'calcul', 'barème'],
  },
  {
    id: 'limite-scans-jour',
    category: 'scanner',
    question: 'Combien de scans puis-je lancer par jour ?',
    answer:
      'Plan Free : 5 scans par tranche de 24h.\nPlan Premium : illimité.\n\nUn scan = un diagnostic complet (financier, fiscal ou argent oublié). Tu peux toujours consulter tes scans passés sans limite.',
    keywords: ['limite', 'quota', 'combien', 'scans', 'par jour'],
  },
  {
    id: 'lancer-demarche',
    category: 'scanner',
    question: 'Comment lancer une démarche depuis l\'app ?',
    answer:
      'Sur la page de résultat de scan (/scanner/[id]), chaque aide affiche un bouton "Lancer la démarche".\n\nEn Premium, on génère le dossier (formulaires pré-remplis avec tes infos), on l\'envoie à l\'organisme compétent et on suit le statut. Tu reçois une notification à chaque étape (envoyé, accusé réception, accepté, payé).\n\nEn Free, tu peux voir la démarche officielle (site, formulaire, pièces) mais le lancement automatique est réservé au Premium.',
    keywords: ['démarche', 'lancer', 'envoyer', 'dossier', 'caf', 'cpam'],
  },
  {
    id: 'frontalier',
    category: 'scanner',
    question: 'Je suis frontalier, est-ce que ça marche ?',
    answer:
      '🌍 Oui — c\'est une de nos spécialités. MUKTI couvre les 8 corridors frontaliers : Suisse 🇨🇭, Luxembourg 🇱🇺, Allemagne 🇩🇪, Belgique 🇧🇪, Italie 🇮🇹, Espagne 🇪🇸, Monaco 🇲🇨, Andorre 🇦🇩.\n\nMUKTI applique les conventions fiscales spécifiques (quasi-résident, télétravail accord 2022 25 %, accord LU 34 j, accord BE 34 j…) et calcule les optimisations possibles. Coche "frontalier" lors du scan et indique ton pays.',
    keywords: ['frontalier', 'suisse', 'luxembourg', 'allemagne', 'belgique', 'convention'],
  },
  {
    id: 'argent-oublie',
    category: 'scanner',
    question: 'Vous trouvez vraiment de l\'argent oublié ?',
    answer:
      '💸 Oui. Le scan "Argent oublié" cherche dans :\n- Comptes bancaires inactifs (Ciclade, loi Eckert)\n- Assurances vie en déshérence\n- Plans épargne salariale oubliés (PEE, PERCO)\n- Trop-perçus CPAM, CAF, impôts\n- Frais bancaires abusifs (article L312-1-1 CMF)\n- Indemnités prud\'hommes non versées\n\nChaque dossier moyen retrouve 200 € à 3 000 €. Lance le scan dans /scanner.',
    keywords: ['argent oublié', 'ciclade', 'assurance vie', 'trop perçu', 'frais bancaires'],
  },

  // ── Wallet & retraits ─────────────────────────────────────
  {
    id: 'wallet-comment',
    category: 'wallet',
    question: 'Comment fonctionne le wallet ?',
    answer:
      'Ton wallet MUKTI cumule :\n- 💰 Les gains en € réels (parrainages, missions rémunérées, concours)\n- ⭐ Les Points (récompenses, daily gift, partages)\n\n1 point = 0,01 €. Tu peux convertir tes points en € à partir de 25 000 points (= 2,50 €). Le retrait IBAN est possible dès 5 € de solde réel.',
    keywords: ['wallet', 'solde', 'points', 'argent', 'cumuler'],
  },
  {
    id: 'retrait-iban',
    category: 'wallet',
    question: 'Comment retirer mon argent sur mon compte bancaire ?',
    answer:
      '1️⃣ Va dans /dashboard/wallet\n2️⃣ Renseigne ton IBAN une seule fois (validé via /dashboard/profile)\n3️⃣ Clique "Retirer" — minimum 5 €, maximum 1 000 € par retrait\n4️⃣ Le virement SEPA arrive sous 1 à 3 jours ouvrés\n\n0 frais, 0 commission cachée. Le retrait IBAN est réservé au plan Premium pour des raisons anti-fraude (vérification d\'identité).',
    keywords: ['retrait', 'iban', 'virement', 'banque', 'sepa', 'récupérer argent'],
  },
  {
    id: 'parrainage-comment',
    category: 'wallet',
    question: 'Comment fonctionne le parrainage ?',
    answer:
      '🤝 Tu obtiens un code unique dans /dashboard/referral.\n- Chaque ami qui s\'inscrit via ton lien : +200 points (= 2 €)\n- Chaque ami qui passe Premium : +50 % de son premier paiement, puis 10 % à vie sur ses abonnements\n- Bonus paliers : Bronze (5 filleuls) → Argent (10) → Or (25) → Platine (50)\n\nPas de plafond, pas d\'engagement. Partage ton lien dans /dashboard/referral.',
    keywords: ['parrainage', 'inviter', 'ami', 'code', 'commission', 'gagner'],
  },

  // ── Premium ───────────────────────────────────────────────
  {
    id: 'free-vs-premium',
    category: 'premium',
    question: 'Quelle différence entre Free et Premium ?',
    answer:
      '🆓 FREE (0 €) : voir toutes les aides détectées · 5 scans/24h · chat MUKTI limité (3 questions/jour) · pas de retrait wallet · pas de lancement de démarches.\n\n⭐ PREMIUM (9,99 €/mois ou 83,90 €/an = -30 %) : scans illimités · chat MUKTI illimité · lancement automatique des démarches · suivi des dossiers · wallet IBAN actif · ×5 places aux concours · cashback boutique · 14 jours d\'essai gratuit.',
    keywords: ['premium', 'free', 'différence', 'plan', 'prix', 'comparaison'],
  },
  {
    id: 'essai-gratuit',
    category: 'premium',
    question: 'L\'essai 14 jours est-il vraiment gratuit ?',
    answer:
      '✅ Oui. Tu renseignes ta carte bancaire (vérification anti-fraude Stripe) mais aucun débit pendant 14 jours. Tu peux annuler en 1 clic depuis /dashboard/settings ou le portail Stripe à tout moment avant la fin de l\'essai → 0 € prélevé.\n\nÀ J+14, si tu n\'as pas annulé, l\'abonnement démarre automatiquement (9,99 € le premier mois, ou 83,90 € pour l\'annuel).',
    keywords: ['essai', 'gratuit', '14 jours', 'trial', 'sans engagement'],
  },
  {
    id: 'annuler-abo',
    category: 'premium',
    question: 'Comment annuler mon abonnement Premium ?',
    answer:
      '1️⃣ Va dans /dashboard/settings\n2️⃣ Clique "Gérer mon abonnement" — tu arrives sur le portail Stripe sécurisé\n3️⃣ Clique "Annuler l\'abonnement"\n\nL\'annulation est effective à la fin de la période en cours (tu gardes Premium jusqu\'à la date payée). Tu peux te réabonner quand tu veux. 0 question posée, 0 frais d\'annulation.',
    keywords: ['annuler', 'résilier', 'arrêter', 'stop', 'abonnement', 'cancel'],
  },

  // ── Sécurité & RGPD ───────────────────────────────────────
  {
    id: 'donnees-securite',
    category: 'securite',
    question: 'Mes données financières sont-elles en sécurité ?',
    answer:
      '🔒 Oui. Toutes tes données sont :\n- Stockées en Europe (Allemagne, RGPD strict)\n- Chiffrées en transit (TLS 1.3) et au repos (AES-256)\n- Jamais revendues, jamais partagées avec des tiers commerciaux\n- Accessibles uniquement par toi (RLS PostgreSQL : un utilisateur ne peut JAMAIS lire les données d\'un autre)\n\nNous ne stockons aucune donnée bancaire (les paiements transitent par Stripe, certifié PCI-DSS niveau 1).',
    keywords: ['sécurité', 'rgpd', 'données', 'chiffrement', 'confidentialité'],
  },
  {
    id: 'supprimer-compte',
    category: 'securite',
    question: 'Comment supprimer mon compte et toutes mes données ?',
    answer:
      '🗑️ Va dans /dashboard/settings → "Supprimer mon compte". La suppression est effective sous 24h : ton profil, tes scans, tes conversations, tes notifications, tes données de situation — tout est définitivement effacé (sauf les factures, conservées 10 ans pour obligation légale comptable).\n\nTu peux aussi exporter toutes tes données au format JSON (RGPD article 20 — droit à la portabilité) avant suppression.',
    keywords: ['supprimer', 'compte', 'rgpd', 'effacer', 'données', 'droit oubli'],
  },
  {
    id: 'mot-de-passe-oublie',
    category: 'compte',
    question: 'J\'ai oublié mon mot de passe, que faire ?',
    answer:
      'Pas de panique 😊 :\n1️⃣ Va sur /login\n2️⃣ Clique "Mot de passe oublié"\n3️⃣ Entre ton email\n4️⃣ Tu reçois un lien de réinitialisation valable 1h\n\nSi tu t\'es inscrit via Google, utilise simplement le bouton "Se connecter avec Google" — pas besoin de mot de passe.',
    keywords: ['mot de passe', 'oublié', 'reset', 'reinitialiser', 'connexion'],
  },
  {
    id: 'changer-email',
    category: 'compte',
    question: 'Comment changer mon adresse email ?',
    answer:
      'Va dans /dashboard/profile → modifie ton email → confirme via le lien envoyé sur ta nouvelle adresse. L\'ancien email reste valide jusqu\'à confirmation.\n\nSi tu utilises Google OAuth, tu dois soit garder l\'email Google, soit re-créer un compte avec une adresse email classique.',
    keywords: ['email', 'changer', 'modifier', 'adresse'],
  },
]
