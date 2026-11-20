# AURORA — De l’intention à l’action

Contribution du 10 novembre 2026. Cette proposition ajoute un parcours concret dans le composant AURORA existant. Elle ne constitue pas une validation clinique ni une mise en production de PURAMA ONE.

## Périmètre et provenance

- Base : `puramapro-oss/mukti`, PR #1, branche `codex/mukti-aurora-lifecycle-20261011`, commit `1e68ef01759e28bf2c47f599ea5435a6d7a1ba12`.
- Proposition empilée sur cette PR pour conserver ses corrections de cycle de vie sans les dupliquer. La PR #1 n’est pas fusionnée à la date de contrôle.
- Mélodie : huit notes originales de la PR #2, commit `b75702a2c4b629e5511af19032c46c9228321533`, réutilisées dans le moteur AURORA. Le prototype Harmonie n’est pas embarqué comme deuxième lecteur.
- Besoin suivi dans [VIDA Spirit #2, avenant du 6 novembre](https://github.com/puramapro-oss/vida-spirit/issues/2).
- Copie de travail isolée : 60 fichiers source/configuration/tests extraits du commit de base, chacun vérifié contre son SHA de blob Git. Il s’agit d’un extrait ciblé, pas d’un checkout complet de production.
- La branche `codex/aurora-intention-musique-20261110` est explicitement désactivée dans `vercel.json` pour les déploiements automatiques. Aucune migration, fusion, publication de site ou exécution de workflow mobile n’est demandée.

## Ce qui est implémenté

### Préparation personnelle

Six réponses composent un texte original : intention, résultat observable souhaité, obstacle, réponse « si… alors… », première action, moment et lieu. Une seule intention est travaillée à la fois. Les approches factuelle, mixte et spirituelle changent l’encouragement ; le geste symbolique reste facultatif.

Le plan comporte huit étapes : installation, intention/résultat, obstacle, réponse prévue, répétition du premier pas, encouragement, action située, retour. L’utilisateur peut utiliser des mots et garder les yeux ouverts sans produire d’images mentales.

Les durées correspondent aux horloges existantes : 128, 248, 468 et 608 secondes. Le texte dispose d’un budget de lecture et de réflexion. Un texte trop long est refusé avec un message précis ; aucune accélération ou troncature automatique. La durée est modifiable sur place sans perdre les champs.

L’aperçu complet doit être confirmé avant le démarrage. Toute modification des champs ou de la durée invalide cette confirmation. Le plan lancé est une copie immuable : modifier une autre référence ne peut pas réécrire une séance en cours.

### Lecture et son

- Le parcours utilise le `useAuroraSession` et l’horloge `useAuroraPhase` existants.
- Les consignes respiratoires imposées, les vibrations de souffle et les scores de régularité ne sont pas exposés dans le rituel. La respiration reste naturelle.
- Voix, musique et tonalité pure disposent de volumes distincts. La narration se choisit explicitement ; la tonalité est éteinte par défaut.
- La mélodie est accordée avec la = 432 Hz ; le sinus continu à 432 Hz est un canal distinct. Aucun bénéfice thérapeutique spécifique à cet accordage n’est revendiqué.
- La musique diminue pendant la narration. Les callbacks périmés ne peuvent pas rétablir un son après arrêt, destruction ou passage à zéro.
- Le texte seul peut démarrer sans instancier Web Audio, sans vibration et sans appel à l’API de séances.
- En rituel, la narration sélectionne explicitement une voix française `localService === true`. Sans cette voix, le démarrage vocal est refusé et l’interface propose le texte ou la musique. Aucune voix distante n’est choisie par défaut.
- Une erreur de synthèse active désactive la voix et affiche une alerte ; le texte reste accessible. Les erreurs d’une ancienne narration annulée ne polluent pas la séance suivante.
- Les réglages se modifient avant lecture ou en pause. Silence coupe les sons immédiatement sans valider ni arrêter artificiellement l’action prévue.
- Pause et passage en arrière-plan arrêtent les sons et gèlent le temps. La reprise avec voix recommence l’étape courante depuis son repère, avec l’horloge recalée ; le texte seul conserve sa position.

### Données et résultats

Le brouillon est conservé en mémoire dans le composant parent pendant les allers-retours entre les deux modes. Quitter ou actualiser la page l’efface. Il n’est ni envoyé à un modèle, ni ajouté à un journal, ni persisté automatiquement. Un export volontaire contient le texte complet et l’action **prévue**.

Le mode rituel ne réutilise pas l’API respiratoire pour écrire des scores inventés : son schéma actuel représente des phases respiratoires, de la régularité et des séries de jours. La fin locale du parcours indique seulement la fin du guidage, jamais la réalisation de l’action, l’atteinte d’un rêve ou une récompense financière.

L’authentification de la page existante est conservée. Les quotas et les API du parcours respiratoire ne sont pas modifiés. Le mode rituel n’invoque aucun service IAO payant.

## Registre de validation

La base a été relancée avant modification : **46 tests PASS**, TypeScript ciblé PASS. Un point intermédiaire à 108 tests a également passé avant les derniers correctifs de confidentialité et de reprise. Ces résultats ne remplacent pas la recette finale ci-dessous.

| Porte de validation | État final | Preuve attendue |
| --- | --- | --- |
| Régressions et nouveaux tests du code AURORA réel | PASS — 156 tests, 9 fichiers | `npm test -- --pool=threads`, sortie 0, 29,56 s |
| TypeScript strict ciblé, imports transitifs inclus | PASS | `npm run typecheck`, sortie 0 |
| Construction du banc client Vite/Tailwind | PASS | `node node_modules/vite/bin/vite.js build --config browser/vite.config.ts`, sortie 0, 706 ms |
| Navigateur réel : mobile, export, durée, silence et vrai graphe audio | BLOQUÉ AVANT SCÉNARIO | Chromium absent ; installation impossible (archive invalide). Firefox crée le navigateur et le contexte, mais la création de page expire. |
| Diff local et périmètre publié | Contrôle décrit dans la PR | Comparaison des blobs locaux à l'arbre Git après publication ; aucun fichier généré destiné à la contribution |
| Build et lint complets avec dépendances de production | NON TESTÉ | Checkout complet et accès à SMARANA/configuration ESLint partagée |
| Synthèse française réelle, iPhone/Safari, Android et Bluetooth | NON TESTÉ | Essais sur appareils et voix locales réellement installées |
| Connexion PURAMA ONE/IAO, sauvegarde d’objectif et récompenses | NON IMPLÉMENTÉ DANS CETTE CONTRIBUTION | Modèle canonique et contrats d’intégration à confirmer |
| Déploiement et comportement en production | NON TESTÉ | Fusion/revue puis recette dans l’environnement autorisé |

Une première recette navigateur a expiré pendant le démarrage du serveur ; une recette de phases n’a démarré aucun worker. L’exécuteur était fortement ralenti. La relance Vitest avec un seul worker threads a exécuté et réussi les 150 tests, sans désactiver leurs assertions. La recette finale, enrichie de six tests DOM du vrai formulaire et de son Blob d'export, a ensuite réussi **156 tests dans neuf fichiers**.

La suite Playwright n’a validé aucun scénario. Chromium était absent ; son téléchargement via la commande officielle a échoué avec une archive invalide. Firefox était installé, mais le premier scénario a expiré après 120 secondes pendant la création de la page, avant l’ouverture de l’application. Un diagnostic indépendant, sans charger le code AURORA ni faire de navigation, a confirmé : navigateur lancé, contexte créé, puis `newPage()` non terminé au bout de 20 secondes. Les essais restants ont été interrompus pour ne pas répéter ce blocage. Il n’existe donc aucune preuve de rendu visuel, de parcours navigateur ou de signal Web Audio réel dans cette livraison.

Le build du banc client a bien réussi (1 759 modules transformés). Vite avertit que les directives Next `use client` ne sont pas préservées dans ce bundle entièrement client ; ce build n’est pas un build Next/RSC. Aucun avertissement n’a été masqué.

### Reproduire les vérifications

Dans `tests/aurora-regression` :

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npx playwright install firefox
npm run test:browser
```

Sous forte contention de processus, `npm test -- --pool=threads` évite de lancer un processus de test par worker ; la suite reste isolée et limitée à un worker.

Le banc de navigateur est conçu pour utiliser les composants, l’horloge et le moteur audio réels dans un serveur local. Seul le Canvas respiratoire WebGL est remplacé. Son shell d’authentification n’est pas exécuté : même un futur succès de ce banc ne prouvera ni connexion Supabase, ni droits réels, ni build Next complet. Le scénario audio est conçu pour observer un signal dans un analyseur Web Audio ; il n’a pas pu s’exécuter ici et ne mesurerait pas un casque, le niveau acoustique ou un effet sur la santé.

Pour utiliser Chromium après installation : `AURORA_BROWSER=chromium npm run test:browser`. La suite s’arrête au premier échec et ne compte pas les scénarios non exécutés comme réussis.

## Fondement et limites du contenu

Le parcours s’inspire de travaux sur la répétition des moyens d’agir et sur l’association souhait/obstacle/plan. Ces travaux ne valident pas automatiquement la combinaison PURAMA, sa voix, sa musique ou une efficacité universelle.

- Pham et Taylor (1999), simulation du processus et des résultats : https://doi.org/10.1177/0146167299025002010
- Wang et al. (2021), méta-analyse du contraste mental avec intentions d’implémentation : https://pubmed.ncbi.nlm.nih.gov/34054628/
- de Witte et al. (2020), interventions musicales et stress : https://pubmed.ncbi.nlm.nih.gov/31167611/
- Calamassi et Pomponi (2019), petit essai exploratoire comparant 432 et 440 Hz : https://pubmed.ncbi.nlm.nih.gov/31031095/
- Spécification Web Speech, distinction entre voix locales et distantes : https://webaudio.github.io/web-speech-api/#dom-speechsynthesisvoice-localservice

Le nom « Martin gâteux » reste non résolu. Aucun texte, identité vocale ou méthode particulière ne lui est attribué. Le guidage proposé est original.

## Travail restant pour la livraison produit

1. Revoir cette contribution et sa dépendance PR #1 avec le responsable du dépôt MUKTI.
   Après fusion de la PR #1, recibler cette proposition vers `main` et résoudre tout changement concurrent avant sa fusion.
2. Confirmer le point d’intégration canonique PURAMA ONE/IAO et son modèle d’objectif ; définir les événements et permissions avant toute synchronisation.
3. Exécuter le build complet, la recette d’authentification et les essais matériels. Les copies canoniques Mac/VPS n’étaient pas accessibles par le pont disponible durant cette tâche.
4. Définir la sauvegarde volontaire, la confirmation manuelle d’une action et toute récompense uniquement dans les services existants, avec idempotence et sans modifier les quotas acquis.
5. Publier seulement après ces validations. La qualité de la contribution ne démontre pas qu’une expérience « parfaite », universellement supérieure ou jamais créée auparavant a été établie.

Les responsables précis de revue et de déploiement ne sont pas attribués dans cette contribution.
