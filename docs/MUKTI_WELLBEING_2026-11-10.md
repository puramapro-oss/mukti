# MUKTI — continuité, journal et participation

Date de qualification : 10 novembre 2026. Contribution candidate qui prolonge le canon PURAMA du 6 novembre et le cycle de vie AURORA de la PR #1 (`1e68ef01759e28bf2c47f599ea5435a6d7a1ba12`). La contribution récente de la PR #3, rituel avec musique (`6edfb20aa6d635444ac1439344611d08a8d768db`), est reprise dans l'intégration : aucun second lecteur ou banc de test n'est nécessaire. Le prototype et le convertisseur audio Harmonie de la PR #2 restent indépendants.

## Résultat et périmètre

Le lot corrige les quatre défauts identifiés dans MUKTI : prédiction de rechute sans validation, attribution de récompenses non délivrées, progression présentée comme une mesure physiologique et faux succès d'enregistrement des habitudes. Il ajoute une disponibilité déclarée commune à deux parcours et un retour facultatif après les séances AURORA.

Ces fonctions décrivent la participation et les choix de la personne. Aucun résultat de test logiciel ne constitue une preuve de guérison, de régénération, de puissance divine, de sécurité clinique, d'unicité mondiale ou de perfection générale de PURAMA.

## Comportements livrés

### Journal personnel

Un texte peut être enregistré sans prestataire IA. L'audio est préparé localement et le micro est libéré avant l'envoi. La transcription et la réflexion facultative exigent deux consentements distincts, versionnés. La sauvegarde du texte précède la réflexion : une panne de l'IA ne fait pas disparaître l'écrit.

La réflexion ne peut contenir que des citations vérifiées dans le texte de la personne et des questions neutres choisies dans une liste fixe. Les anciennes métriques sont conservées comme historique en base, exclues des réponses de l'application, et interdites dans les nouvelles entrées. Le cron de prédiction est inerte et son planning est retiré ; les anciennes notifications de ce type ne sont plus proposées dans l'écran de notifications.

L'utilisateur peut supprimer son entrée. Un service tiers n'est appelé qu'après l'accord correspondant. Les tests utilisent exclusivement des contenus synthétiques et des prestataires simulés.

### Habitudes et reconnaissance

Une habitude peut être enregistrée comme geste proposé, version adaptée ou repos. Un repos n'est jamais compté comme un exercice réalisé. Les acquis visibles sont cumulatifs. Une erreur de lecture ou d'écriture reste une erreur ; un conflit d'unicité ne devient un succès qu'après relecture de la ligne du bon propriétaire. L'agrégat SQL remplace la limite silencieuse de 500 lignes.

« Ma journée compte » remplace le tirage de récompenses. La reconnaissance est gratuite, déterministe et idempotente, compatible avec le repos ou l'absence d'activité. Elle n'émet aucun point, coupon, monnaie, quota ou droit financier. Les anciens reçus restent lisibles avec une délivrance explicitement non vérifiée. Aucune nouvelle promesse budgétaire et aucune modification de solde ne sont introduites.

Le rituel et la disponibilité utilisent la journée Europe/Paris, affichée. La reconnaissance garde une journée UTC explicite et fixée côté serveur ; elle ne dépend pas d'un fuseau fourni par le client. Les anciennes dates d'habitude gardent leur provenance UTC.

### AURORA

Le mode Soft, sans rétention, est le défaut. Les paliers deviennent des repères de participation cumulée ; aucun score d'horloge ne mesure le souffle de la personne ni ne recommande une intensité supérieure. Les anciens paliers acquis restent conservés. Les compteurs de séances et de minutes sont recalculés depuis les lignes enregistrées : ils peuvent corriger un ancien affichage discordant, sans reconstruire des séances manquantes.

La complétion et le récapitulatif sont enregistrés dans une transaction SQL. Les reprises retournent la même séance déjà enregistrée ; une panne du récapitulatif annule toute la transaction. La durée, l'ordre des phases et le propriétaire sont vérifiés. Une déclaration explicite de vertiges met également la variante en pause dans les suggestions. Rejouer une ancienne complétion ne réactive pas cette pause après une reprise volontaire.

Le rituel personnel de la PR #3 conserve son aperçu confirmé, son texte facultativement accompagné de musique et de voix locale, et son action explicitement prévue. Il réutilise la même horloge. Ce rituel local n'est pas enregistré comme une séance respiratoire ni comme une action réalisée ; le nouveau retour persistant concerne les séances effectivement confirmées par l'API.

### Disponibilité et retours

Le formulaire commun aux écrans AURORA et rituel minimaliste conserve quatre choix déclarés — physique, attention, confort sensoriel et disponibilité sociale — et un temps disponible. Il n'infère pas la santé. Le repos ou l'absence de réponse restent possibles. Une variante n'est suggérée que si sa durée réelle tient dans le temps déclaré et qu'elle n'est pas en pause.

Le retour porte sur une vraie séance du propriétaire. Il est facultatif et distinct à proximité de la séance ou plus tard. Le seuil de quatre heures organise les fenêtres du formulaire ; il n'est pas un seuil clinique. Sans réponse, le ressenti reste inconnu. Un ressenti moins bon ou un inconfort met la variante en pause dans les suggestions, sans conclure à un lien causal. La personne peut réactiver les suggestions volontairement. Effacer les retours ne réactive pas silencieusement ces suggestions.

Les écrans conservent les brouillons lors d'une panne, empêchent les doubles soumissions, ignorent les réponses devenues obsolètes et exigent un nouvel accord quand la séance ou la journée cible change. Le délai réseau termine aussi une requête dont le transport ignore l'annulation.

### Disposition et contrôles visuels

L'inspection des captures a révélé une règle globale de remise à zéro des marges et du padding qui annulait les espacements Tailwind. Le scénario mobile a reproduit le défaut avant correction. Cette règle est désormais dans la couche CSS `base`, ce qui rend aux classes de disposition leur effet prévu.

Sur le viewport testé de 390 × 844 px, le chevauchement du header de 48 px devient un espace de 44 px ; les boutons principaux passent de 22 à 46 px de hauteur. Les marges latérales, l'espace supérieur et le centrage sont rétablis. Les [mesures avant/après et captures](evidence/browser-2026-11-10/layout-before-after.md) complètent les assertions fonctionnelles. Cela ne constitue pas un audit visuel de toutes les pages de MUKTI.

## Données et migration

Appliquer dans l'ordre les migrations `0013` à `0017`. Elles sont additives et ne suppriment aucun ancien écrit ou reçu. Les écritures des tables concernées sont réservées au serveur après authentification et résolution du profil. Les utilisateurs ne peuvent plus modifier directement les champs de rôle, solde ou abonnement du profil ; les paramètres ordinaires autorisés restent modifiables.

Les fonctions de transaction utilisent `SECURITY INVOKER` et un droit d'exécution réservé à `service_role`. La fonction de profil existante et la RLS restent les frontières de lecture. Une clé de service ne doit jamais être fournie au navigateur.

La qualification SQL utilise PostgreSQL compilé en WebAssembly avec PGlite. Les rôles et les utilisateurs sont des fixtures locales. Le schéma de fondation et les définitions des tables existantes sont lus depuis le dépôt ; les cinq nouvelles migrations sont exécutées réellement et répétées. Cette qualification ne reproduit pas un serveur Supabase déployé, ses extensions, son état de migration ou plusieurs processus concurrents.

## Registre des preuves

Le [reçu structuré de qualification](evidence/wellbeing-qualification-2026-11-10.json) relie les commandes, résultats, versions, limites et empreintes SHA-256 des fichiers source et des preuves. Les résultats ci-dessous sont locaux ; les workflows et services distants gardent leur propre état.

| Contrôle | État | Preuve / limite |
| --- | --- | --- |
| Suite consolidée | PASS | 353 tests, 23 fichiers, après reprise du rituel #3 et correction des dépendances ; rapport JSON `evidence/wellbeing-tests-2026-11-10.json`. |
| Transactions, droits et migrations | PASS | 15 tests SQL inclus : RLS, anciens grants, idempotence, rollback, héritage conservé, 601 jours d'habitudes, retours et arrêt pour vertiges. |
| TypeScript du périmètre | PASS | `npm run typecheck`, exit 0 après intégration et alignement PostCSS : tests, routes, composants et fichiers du banc navigateur inclus. [Journal](evidence/wellbeing-typecheck-2026-11-10.txt). |
| TypeScript de l'application complète | PASS | Contrôle global exécuté par le build Next 16.4.6 sur le code intégré et le verrouillage de production corrigé. Le harness autonome est exclu du build applicatif et vérifié séparément. |
| Compilation Next.js | PASS | `npm run build -- --webpack`, exit 0 après la correction CSS : compilation, TypeScript, génération des pages et collecte des traces. [Journal complet](evidence/next-build-2026-11-10.txt). |
| Chromium | PASS | 10 scénarios, 35,25 s, zéro échec/ignoré/retry ; vrais composants, MediaRecorder et graphe Web Audio, API simulées. [Rapport JSON](evidence/browser-2026-11-10/results.json). |
| Disposition mobile | PASS | Échec reproduit avant correction, puis assertions géométriques et inspection des captures mobile/desktop. |
| Dépendances de la suite | PASS | Audit npm après correction : zéro paquet signalé. Ce résultat porte sur les avis connus au moment de l'audit. |
| Dépendances de production | PARTIEL | 29 → 13 paquets signalés ; critiques 5 → 2, élevées 8 → 1. Les 13 alertes restantes appartiennent au graphe OpenTimestamps existant. |
| Lint complet | BLOQUÉ | La configuration partagée `@purama/eslint-config` pointe vers un dossier absent de ce checkout. Aucun résultat de lint complet n'est revendiqué. |
| Base, prestataires et appareils réels | NON TESTÉ | Aucune migration distante, aucun appel réel de transcription/réflexion, aucun téléphone ou micro utilisateur. |
| Mise en production | NON EFFECTUÉE | Branche candidate ; déploiement automatique désactivé pour cette branche. |

Commandes de la suite isolée, depuis la racine :

```sh
npm --prefix tests/aurora-regression ci --ignore-scripts --no-audit --no-fund
npm --prefix tests/aurora-regression test
npm --prefix tests/aurora-regression run typecheck
```

La suite emploie un verrouillage autonome de dépendances. Les résultats ne remplacent pas la compilation avec le verrouillage de production. Les tests Playwright historiques visant les domaines de production n'ont pas été lancés.

Le moteur local est Chromium 147.0.7727.0, distribué par `@sparticuz/chromium` 147.0.2 et piloté par Playwright 1.59.1. Le CDN Playwright était indisponible ; le navigateur standard 147.0.7727.15 prévu par Playwright reste une qualification CI distincte. Le [reçu d'exécution](evidence/browser-2026-11-10/runtime.json) conserve provenance, intégrité, arguments et versions. Les options de ce navigateur local ne qualifient pas les protections du navigateur ou la politique CSP. Le canvas WebGL est remplacé uniquement dans le banc ; les API du serveur et l'authentification réelle ne font pas partie de ces dix scénarios.

Le [rapport des dépendances](DEPENDENCIES_SECURITY_2026-11-10.md) conserve les versions corrigées, les avis des éditeurs, les audits avant/après et les limites OpenTimestamps.

Le banc déclare PostCSS 8.5.29 pour partager les types attendus par Vite et Tailwind ; Next conserve sa version 8.5.23 dans son propre graphe. Le contrôle TypeScript a détecté cette incompatibilité avant sa correction. Aucune exclusion du fichier de configuration ni conversion de type non vérifiée n'a été ajoutée pour la masquer.

## Limites fonctionnelles conservées

- Le temps déclaré filtre chaque proposition. Il ne constitue pas encore un budget cumulé décrémenté entre toutes les activités de l'écosystème.
- Les intégrations HealthKit/Health Connect, le parcours clinique du sommeil, l'accompagnement médical, les mesures physiologiques et la qualification des appareils restent hors de ce lot.
- Une réponse à un ressenti n'est ni un diagnostic ni une orientation clinique automatisée. Les liens d'aide restent disponibles sans contact envoyé automatiquement.
- Le limiteur de requêtes existant reste par processus. Une limitation globale et un budget d'appels prestataires doivent être qualifiés avant une exposition à grande échelle.
- Les tests de persistance ne constituent pas une épreuve de charge concurrente entre plusieurs processus.
- Le graphe OpenTimestamps nécessite une migration qualifiée avant de déclarer le socle de dépendances assaini. Il reste utilisé par les concours existants ; aucun retrait silencieux ni remplacement cryptographique incompatible n'est effectué.
- Les exemples d'accès d'administration en clair ont été neutralisés dans les consignes du dépôt. Leur validité n'a pas été testée. Si ces valeurs étaient actives, le propriétaire doit les révoquer ou les renouveler ; l'historique Git demeure distinct de ce nettoyage du fichier courant.

## Intégration et exploitation

1. Intégrer dans l'ordre la contribution AURORA #1 puis le rituel #3 dont cette branche dépend, et réexaminer ensuite la différence de cette contribution sur `main`.
2. Sur un environnement de préproduction, sauvegarder les données et qualifier le schéma existant ainsi que les droits des rôles avant les migrations.
3. Prévoir une courte indisponibilité des écritures des fonctionnalités concernées pendant la bascule. Les nouvelles routes exigent les migrations ; l'ancien journal ne doit pas écrire ses scores dans le nouveau contrat.
4. Appliquer les cinq migrations puis la nouvelle application. Vérifier les scénarios avec deux comptes synthétiques et les refus entre propriétaires ; vérifier les paramètres de profil utilisés par les autres parcours.
5. Qualifier séparément transcription, réflexion, limites globales, navigateur et appareils. Les essais cliniques ou les allégations sanitaires ne découlent pas de cette recette logicielle.
6. En cas d'échec, désactiver le parcours concerné en conservant les données et les droits fermés. Éviter un retour automatique aux anciennes attributions et prédictions ou à des permissions générales d'écriture.

## Sources techniques vérifiées

- [Supabase — privilèges de colonne](https://supabase.com/docs/guides/database/postgres/column-level-security).
- [PostgreSQL — REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html) : une révocation au niveau table retire les privilèges de colonne correspondants ; l'inverse ne suffit pas. Les tests contrôlent les permissions effectives.
- [PGlite — API](https://pglite.dev/docs/api) : exécution locale des requêtes et migrations PostgreSQL.
- [OpenAI — transcription audio](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create) : contrat `whisper-1` et retour `verbose_json` avec durée. Aucun appel prestataire réel n'a été utilisé pour la qualification.
- [Tailwind — styles de base](https://tailwindcss.com/docs/preflight#extending-preflight) : les valeurs par défaut s'ajoutent dans la couche `base` pour préserver le fonctionnement des classes utilitaires.
