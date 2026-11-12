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

## Complément du 12 novembre 2026 — continuité des séances et des programmes

### Existant retrouvé et choix d'intégration

Cette contribution part de la PR #8, `audit/mukti-integrated-accessibility-20261111`, à `6b863eb9476819fb55b19e2db408a8b6dec89ca9`. Elle prolonge la composition AURORA, Harmonie, widget et accessibilité existante. Elle ne recrée ni application de santé, ni moteur audio, ni compte, ni table de séances.

La recherche de continuité a recoupé les dépôts autorisés, le document utilisateur « PURAMA_Coque_Extension_Spooky_Dream.md » du 13 septembre 2026 et les sections MUKTI du canon utilisateur. Elle est limitée aux sources accessibles ; elle ne constitue pas une lecture exhaustive de tous les anciens échanges.

| Élément retrouvé | État vérifié | Décision pour ce lot |
| --- | --- | --- |
| MUKTI / AURORA | Séances, texte de rituel, voix locale facultative, musique et moteur audio existants | Réutiliser `createAuroraAudio`, les préférences et les tables existantes. |
| Harmonie et /frequences | Branche historique `audit/mukti-hardware-compat-20261023`, tête inspectée `701dd778655e087893fb7d7e02661c63718e07f6` ; le lecteur /frequences n'est pas dans la base PR #8 | Garder cette dépendance visible ; ne pas recopier un troisième générateur ou déclarer sa fusion acquise. |
| SANGHA V2 | Intention historique de méditation, hypnose et rituels ; SANGHA actuel comprend aussi les cercles | Ne pas assimiler le nom historique à une fonction actuellement livrée. |
| SOMA / ancien VIDA PULSE | Continuité respiration/AETHER et code audio retrouvés | Garder une identité distincte ; aucun renommage ni second moteur dans ce lot. |
| VIDA Spirit | Expériences visuelles/spirituelles dans la continuité retrouvée | Aucun statut thérapeutique ni fusion implicite. |
| Spooky / Dream Machine / Kasina | Conception d'extensions dans le document de septembre ; pas de pilote matériel qualifié retrouvé dans le périmètre inspecté | Qualification par modèle exact dans le document appareils existant. |
| PURAMA ONE santé / Quantiq | PR ONE #11 désormais fusionnée ; le cadrage santé existe séparément | Continuer ce socle et relier MUKTI, sans lui attribuer les mesures ou autorisations d'un autre produit. |

La présence de `hypnose_scripts` dans le contrat de programme est distincte d'un lecteur d'hypnose opérationnel : le `ProgramView` inspecté ne les affiche pas. Un script généré ou accepté par un schéma n'est pas un protocole clinique validé.

### Défauts traités dans les fonctions existantes

**Séance multisensorielle et micro-méditation.** La respiration libre devient le défaut ; le guidage doux existant est facultatif, sans rétention. Le son est déclenché explicitement, réutilise AURORA et suit la préférence de silence. Le repère de 432 Hz est un choix sonore, sans propriété curative attribuée. Les vibrations sont facultatives et liées aux capacités disponibles. Les préférences de mouvement réduit s'appliquent au guide visuel. L'arrêt, le démontage, le masquage et `pagehide` invalident les actions tardives ; aucune reprise automatique n'est demandée au retour.

La minuterie utilise une horloge monotone. Une fin de minuterie devient `completed`, et non `resisted` : le temps écoulé ne démontre ni résistance à une pulsion, ni amélioration de santé. Le ressenti après séance reste facultatif. Le son produit numériquement, le niveau acoustique physique et l'effet sur une personne restent trois observations distinctes.

**Cadre de séance et reçu.** La durée est figée à la fin de l'activité ; le temps passé dans le formulaire ne s'y ajoute pas. La première tentative fige les réponses et un UUID cryptographique. En cas d'incertitude, le formulaire reste visible et la reprise renvoie le même payload. Le composant attend un reçu correspondant à la séance avant d'annoncer son enregistrement. La sortie utilise une destination locale déterministe vers la fiche concernée, y compris lorsque le mode a été ouvert sans historique. Aucune sauvegarde locale n'est inventée et aucune donnée de séance n'est ajoutée au stockage local du navigateur.

La route réutilise la clé primaire de `mode_sessions` : nouvelle insertion 201 ; même séance, même propriétaire et mêmes données 200 ; identifiant réutilisé avec d'autres données ou propriétaire 409 générique. Une panne de lecture ne devient pas un succès. Le score existant est recalculé après une nouvelle insertion, pas après un replay. Les appels historiques sans identifiant client restent compatibles. Les horodatages civils viennent du client ; ils ne sont pas des attestations serveur.

**Structure des programmes.** Un schéma Zod unique fournit les types, le JSON Schema de l'outil et les contrôles après génération, avant toute écriture et à la lecture. Les plantes peuvent être absentes et sont normalisées à une liste vide ; le nom latin absent devient `null`. Les champs inconnus ne sont pas propagés. Le prompt autorise le relais vers un médecin, n'impose plus de plantes et exclut prescription et protocole universel de sevrage.

Ces contrôles n'évaluent pas la pertinence clinique du contenu libre. L'authentification réelle, les prestataires réels, la migration des anciens programmes et la qualification des scripts restent des travaux distincts.

Le résumé de génération utilise le programme normalisé effectivement retourné par le stockage. Un ancien contenu invalide ne fait plus disparaître le reste de la fiche. Le délai de régénération est contrôlé à partir de la date du dernier programme, indépendamment du contenu et de la présence d'une version courante. Une erreur de lecture ou une date invalide ne devient pas une autorisation de générer. Les actions de reprise rechargent la page pour refaire la lecture.

### Extension fonctionnelle cohérente

La poursuite du produit doit garder un parcours court : choisir une intention et une durée, consulter le contenu et ses options, commencer volontairement, arrêter simplement, puis enregistrer un ressenti facultatif. La liste de technologies n'est pas l'écran d'accueil.

Les composants existants peuvent accueillir un catalogue de contenus avec auteur, version, langue, durée, sources et état de revue. Une séance de relaxation, une pratique spirituelle, un contenu d'éducation à la santé et un protocole thérapeutique doivent conserver leurs destinations et leurs preuves propres. La formation PURAMA doit être importée à partir de ses contenus réels et de ses droits, sans inventer les rituels manquants.

Avant d'ouvrir une recommandation personnalisée de plante ou de produit, la fiche doit identifier sa composition exacte, sa forme, sa traçabilité, ses contre-indications documentées et les interactions connues. Les produits vendus par PURAMA doivent être signalés comme tels ; un classement ou une proposition d'achat ne constitue pas une validation thérapeutique. Aucune liste universelle de produits « les plus puissants » n'est créée à partir de leurs noms commerciaux.

L'expansion à l'ensemble de la santé doit être suivie par domaine et par destination d'usage : information, prévention, suivi déclaré, mesure avec appareil qualifié, orientation, puis éventuelle fonction médicale selon ses preuves et obligations propres. La caméra, l'audio ou la fréquence ne deviennent pas un diagnostic général.

### Recherche et décisions de preuve

- **Hypnose :** le [NCCIH](https://www.nccih.nih.gov/health/hypnosis) décrit des résultats variables selon les indications, notamment douleur et syndrome de l'intestin irritable. Cela ne permet pas de garantir un effet pour tous ni de valider les scripts générés par MUKTI.
- **Méditation :** la [synthèse NCCIH](https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety) rappelle que les résultats et effets indésirables dépendent de la pratique et de la personne. Le produit doit permettre de réduire, arrêter ou choisir du texte seul.
- **432 Hz :** le [petit essai pilote publié](https://pubmed.ncbi.nlm.nih.gov/31031095/) ne démontre pas de guérison universelle ni de toxicité de l'accordage 440 Hz. Le repère musical reste une préférence.
- **Battements binauraux :** la [revue systématique PLOS](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023) rapporte des résultats hétérogènes sur l'entraînement des oscillations cérébrales ; une différence numérique de fréquence ne prouve pas un état mental obtenu.
- **Spooky2 :** son [avis légal officiel](https://www.spooky2.com/legal/) présente des appareils expérimentaux et ne revendique pas une destination de diagnostic ou traitement ; la mention FDA ne doit pas être transformée en conclusion réglementaire sur tous les pays.
- **Lumière pulsée :** les [précautions de Dream Machine Technology](https://dream-machine.tech/pages/risques-medicaux) sont propres à son dispositif. La [publication PLOS de 2026](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0359958) ne transforme pas un questionnaire en garantie individuelle de sécurité.
- **Produits naturels :** le [NCCIH](https://www.nccih.nih.gov/health/safety) décrit des interactions et des contaminations possibles. « Naturel », « pur » et « quantique » ne remplacent pas l'identification du produit et ses preuves.
- **Contrat technique :** la [documentation Zod](https://zod.dev/json-schema) décrit la génération de JSON Schema ; elle ne qualifie pas la vérité du contenu généré.

### État de la vérification de ce complément

Le passage final local a exécuté **127 tests ciblés, cinq fichiers, code de sortie 0**, sur le banc autonome après corrections et revue indépendante. Le contrôle TypeScript du périmètre importé termine également avec le code 0. Une exécution contre l'ancien cadre et l'ancienne route exacts de PR #8 reproduit 13 échecs attendus : durée gonflée par le formulaire, perte de la possibilité de reprendre et idempotence absente. Sept autres cas reproduisent le défaut de navigation avant sa correction. Ces essais utilisent des frontières externes explicitement simulées.

La revue indépendante a identifié puis relu les corrections de trois consommateurs : résumé SSE après normalisation, lecture d'un ancien programme invalide et sortie d'un mode ouvert sans historique. La qualification de l'ensemble du dépôt, du navigateur et des dépendances doit être lue dans les workflows attachés au commit de la PR candidate. Les dépendances directes Framer Motion 12.38.0, clsx 2.1.1 et tailwind-merge 3.5.0, déjà utilisées en production, sont verrouillées dans le banc pour vérifier les imports réels de la fiche ; aucune dépendance de production n'est changée.

Le navigateur local a été bloqué avant chargement par une restriction de sockets. Quatre scénarios navigateur supplémentaires sont fournis pour la chaîne CI standard, avec vrais composants et graphe Web Audio, API et navigation explicitement simulées. La présence de ces scénarios n'est pas une preuve de réussite.

Le [reçu local avant publication](evidence/mukti-modes-programs-2026-11-12.json) conserve le périmètre, les résultats, les limites et les empreintes des fichiers de contrôle. Les workflows de la PR fournissent séparément la qualification distante de son commit.

Limites conservées : versionnement des programmes non transactionnel hérité ; pas d'essai Supabase réel ou de charge concurrente ; pas d'appel réel à un modèle ; pas de lecteur d'hypnose qualifié ; pas d'appareil Spooky, Dream Machine ou Kasina testé ; pas de validation clinique ; pas de mise en production dans ce lot. Les résultats historiques du 10 novembre ci-dessus ne sont pas automatiquement transférés au nouveau code.


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

