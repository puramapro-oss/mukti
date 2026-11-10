# Vérification des composants dans Chromium

Ce harness importe les vrais composants Journal, MinimalHabitsList, MysteryChest, WellbeingCheckin, WellbeingFeedback et AURORA ainsi que les styles du produit. Il adapte `next/link` en lien HTML, car il ne lance pas le routeur Next.js. Pour les quatre scénarios de rituel repris de la PR #3, le canvas WebGL de respiration est remplacé par un fond neutre ; le texte, l'horloge et le graphe Web Audio restent réels.

Les dix scénarios Playwright utilisent un vrai Chromium, un contexte neuf et des données synthétiques. Toutes les API sont interceptées. Toute requête HTTP vers un hôte non local, ou une API non prévue, fait échouer le scénario. Le scénario audio utilise le faux périphérique audio fourni par Chromium et le vrai MediaRecorder du navigateur ; aucun microphone utilisateur n'est sollicité. L'instrumentation du rituel observe le gain audio réel avec un analyseur, sans remplacer la génération sonore ni l'horloge.

## Exécution autonome

Exécuter ces commandes depuis `tests/aurora-regression`. L'installation des dépendances à la racine de l'application n'est pas nécessaire.

```sh
npm ci
npx --no-install playwright install --only-shell chromium
npx --no-install playwright test --config browser/playwright.config.ts
```

Les versions de Playwright, Vite, React et Tailwind sont celles du lockfile de ce harness. Sa configuration PostCSS est explicite ; elle n'utilise pas celle de l'application. Les sources CSS des composants testés sont déclarées dans `styles.css`.

Le serveur Vite écoute uniquement `127.0.0.1:4173`. La vue `?view=aurora` réutilise le rituel ; les autres vues sont `journal`, `minimal`, `recognition` et `wellbeing`. Les tests utilisent un seul worker et ne ciblent jamais les URLs de production. Le JSON et les éventuelles traces d'échec sont écrits dans `browser/test-results/`, ignoré par Git. Par défaut, Playwright choisit son `chromium-headless-shell` installé par `--only-shell` ; aucun chemin de Chrome complet n'est forcé. Un Chromium déjà installé peut être choisi explicitement avec `MUKTI_TEST_CHROMIUM_PATH`. Si sa distribution exige des arguments, `MUKTI_TEST_CHROMIUM_ARGS` accepte un tableau JSON de chaînes.

## Couverture

1. Journal : sauvegarde sans IA, conservation de l'ancien écrit et suppression de l'entrée sélectionnée.
2. Journal : erreur de sauvegarde, reprise avec le même identifiant et consentement facultatif explicite.
3. Audio : vrai MediaRecorder, arrêt des pistes, aucun envoi avant accord, puis transcription simulée.
4. Rituel : repos déclaré, progression conservée et aucune pratique déclarée à sa place.
5. Reconnaissance : erreur puis reprise, historique sans doublon et absence de valeur financière.
6. Disponibilité et retours : accords explicites, état de séance fourni par l'API simulée et retrait de la variante après ressenti moins bon.
7. Rituel AURORA sur viewport mobile : préparation, consentement, texte seul, pause, export et brouillon conservé ; espacements réellement rendus, absence de chevauchement avec le header et commandes d'au moins 44 px de hauteur avec padding. Les mesures de préparation et de lecture sont jointes au rapport JSON.
8. Rituel AURORA : durée modifiable, aperçu invalidé et saisie Unicode sans troncature.
9. Rituel AURORA : signal dans le vrai graphe Web Audio, silence immédiat, reprise et arrêt.
10. Rituel AURORA : absence de voix locale signalée puis démarrage en texte seul.

## Moteur de qualification locale

Le 10 novembre 2026, le téléchargement officiel Playwright a renvoyé une page HTML « Site Unavailable » de 195 octets à la place du ZIP, après cinq essais. Pour débloquer la qualification locale, le package publié `@sparticuz/chromium@147.0.2` a été installé dans un cache extérieur au dépôt. Son binaire annonce `Chromium 147.0.7727.0`, alors que Playwright 1.59.1 attend la révision `147.0.7727.15`.

L'extraction utilise les fichiers Brotli officiels du package et sa dépendance `tar-fs`, avec `chown: false` pour conserver le propriétaire local : le conteneur refuse les changements de propriétaire d'archive. Elle vérifie la signature ELF et une taille non nulle avant `--version`. Aucun paquet système ni navigateur de l'utilisateur n'est utilisé. La distribution, l'intégrité npm, les arguments de lancement, les versions des dépendances testées, la commande et son code retour sont enregistrés dans le rapport local `runtime.json`. Ce moteur constitue une qualification locale distincte du moteur Playwright par défaut prévu en CI ; ses arguments serveur ne qualifient pas les protections du navigateur ou la politique CSP.

Le flag serveur `--single-process` est retiré pour cette qualification : le premier contexte fonctionnait, puis l'ouverture du deuxième fermait le navigateur. Deux contextes locaux successifs ont été vérifiés après son retrait avant de relancer les scénarios. Les autres arguments de la distribution sont conservés, avec WebGL désactivé ; ce choix correspond au périmètre qui exclut le canvas de respiration.

Cette qualification ne prouve pas l'authentification réelle, les droits PostgreSQL/RLS, les prestataires IA, la qualité médicale, un téléphone physique, le routage complet Next.js ou un déploiement. Les résultats d'exécution doivent être rapportés séparément ; la présence de ces fichiers ne signifie pas que les tests ont passé.
