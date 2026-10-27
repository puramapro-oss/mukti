# MUKTI — écoute à distance : réalisation et audit du 27 octobre 2026

**État : fonction logicielle d'écoute seule intégrée sur la branche d'audit et vérifiée dans les scénarios ci-dessous. Pas de déploiement. L'accès mondial à des milliers d'auditeurs, la liaison aux deux appareils physiques et la fidélité acoustique restent NON VALIDÉS.**

## Demande et périmètre réellement livré

La demande vise des séances accessibles sur téléphone, sans obligation d'achat d'un MUKTI, en complément des modèles Portable et Salon. Cette intervention réutilise les cercles et le relais LiveKit déjà présents. Elle ne crée pas de troisième appareil ou de seconde plateforme.

La fonction ajoutée est une **écoute seule pour un membre authentifié et admis dans un cercle SFU existant**. Aucun contrôle de possession d'un appareil n'a été ajouté. Les conditions d'accès, la capacité et les restrictions des cercles restent applicables. Il ne s'agit pas encore d'un service de diffusion publique illimitée depuis le firmware d'une antenne.

Une transmission audio ne transmet pas le plasma, la stimulation électrique, un champ thérapeutique ou l'effet mécanique d'un équipement distant. Aucun effet médical ou énergétique à distance n'a été implémenté ou validé.

## Versions

- Dépôt : `puramapro-oss/mukti`.
- Branche : `audit/mukti-hardware-compat-20261023`.
- Départ : `f433cbafbe4679a4a284a64a4c49ca1915a687a8`.
- Implémentation et premiers tests : `9361d8e8f8fd5891bef8382a34fff03bde7059c2`.
- Ajout des tests d'interface : `4dc498c6f9636a87c6a16835dae1c8cf93740e92`.
- Activation de ces tests dans le contrôle permanent : **`fdc915e0f09cfe8301ef3f2b91da92e556932c83`**.
- Comparaison 4dc498c → fdc915e relue : seul `.github/workflows/aurora-regression.yml` change ; les sources applicatives, tests et dépendances sont identiques.
- `main` relue inchangée à `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Déploiement de la branche d'audit désactivé dans `vercel.json`, sans modification de cette configuration.
- Aucun achat, migration de production, modification de données clients, connexion à un serveur LiveKit réel ou commande matérielle. Aucune modification des puissances, du firmware, des dépendances ou du verrou npm.

## Fonctions intégrées

| Partie | Comportement réalisé |
|---|---|
| `src/lib/circle-listener.ts` | Réception audio uniquement ; réutilise `auroraRequest`, sans accès à la publication du microphone. |
| `CircleListeningPanel.tsx` | Démarrer, arrêter, volume local et autorisation explicite de lecture lorsqu'elle est demandée par le navigateur. Aucun démarrage de ce lecteur au montage du composant. |
| `CircleAudioControls.tsx` | Choix explicite entre écoute et conversation ; les moteurs de conversation existants sont conservés et démarrent avec la commande locale de microphone coupée. |
| `CircleRoom.tsx` | Raccordement réel des commandes au salon ; retrait immédiat du composant audio lors de Quitter, avant l'attente de la requête de départ. |
| Route `livekit-token` | Requête facultative `listenOnly: true`, validation du corps et plafond de 1 024 octets ; authentification, appartenance active, état du cercle et mode SFU toujours vérifiés. |
| `src/lib/livekit.ts` | Un jeton d'écoute seule reçoit `canPublish: false` et `canPublishData: false`. Les demandes interactives existantes conservent leur contrat. |
| Résistance aux courses asynchrones | Un arrêt invalide une réponse tardive et ferme aussi une connexion qui aboutirait après l'arrêt ou le délai de connexion. |
| Ressources audio | Suivi par piste, pas seulement par participant ; plusieurs pistes d'un même participant restent distinctes. Les éléments sont mis au silence, détachés et retirés à l'arrêt. |

Le volume initial du lecteur est un gain numérique de 0,25, pas un niveau acoustique calibré. Le curseur et son effet réel doivent être essayés sur les navigateurs et sorties cibles, notamment les plateformes qui restreignent le volume des éléments multimédias.

Le jeton d'écoute est valide 300 secondes par défaut pour l'entrée. Cette durée ne représente pas une limite de durée de séance ni une révocation automatique d'une connexion déjà établie. Un membre déjà autorisé à une conversation peut demander un nouveau jeton interactif selon les règles existantes ; le mode d'écoute ne crée pas un rôle global irrévocable.

Le lecteur attend au plus le délai du transport partagé pour les réponses serveur et 15 secondes pour la connexion SFU. Les échecs finaux permettent un nouvel essai explicite ; aucune boucle de requêtes automatique n'a été ajoutée. Les reconnexions transitoires restent celles du SDK existant.

## Exécutions réellement vérifiées

### Régressions finales

Run **40525396349**, commit **fdc915e0f09cfe8301ef3f2b91da92e556932c83** :
https://github.com/puramapro-oss/mukti/actions/runs/40525396349

- Job **122263533413** : régressions, typage du banc, différences Git et audit des dépendances du banc — succès.
- Job **122263533155** : PostgreSQL jetable — succès.
- Job **122263532539** : audit des dépendances applicatives — succès.

Journal détaillé du job de régression relu : **134 tests React existants réussis, 120 tests Node existants réussis et 55 nouveaux tests d'écoute réussis, aucun échec ni test ignoré dans ces suites.**

### Application complète

Run **40525295285**, commit **4dc498c6f9636a87c6a16835dae1c8cf93740e92**, job **122263107216** :
https://github.com/puramapro-oss/mukti/actions/runs/40525295285

Toutes les étapes sont terminées avec succès : intégrité du paquet amont, installation complète, régressions de sécurité de l'horodatage, TypeScript global, lint, build et contrôle exigeant zéro signalement de dépendance de production. Ce run porte sur les mêmes sources applicatives et tests que le dernier commit ; seule la commande du workflow de régression a changé ensuite, comme vérifié par comparaison Git.

Le run de régression intermédiaire 40525295291 a été annulé par la règle de concurrence lors de la mise à jour du workflow. Il n'est pas compté comme réussi ; il est remplacé par le run final réussi.

### Commandes du banc isolé

Répertoire `tests/aurora-regression` :

| Commande | Résultat observé |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Sortie 0 |
| `npm test -- --reporter=verbose` | 134/134, sortie 0 |
| `node --test transport-regression.mjs audio-regression.mjs completion-wiring.mjs mediapipe-regression.mjs nature-regression.mjs` | 120/120, sortie 0 |
| `node --test remote-listening-client.mjs remote-listening-server.mjs remote-listening-ui.mjs` | 55/55, sortie 0 |
| `npm run typecheck` | Sortie 0 |
| `npm audit --package-lock-only --audit-level=high` | Sortie 0 ; 0 vulnérabilité signalée dans le verrou isolé |

Les **55 nouveaux cas** comprennent **47 contrôles client/serveur et huit contrôles d'interface**. Ils ne sont pas inclus une seconde fois dans les 134 tests React existants. Les nouveaux tests d'interface utilisent les véritables composants React dans jsdom, avec le relais et les moteurs de conversation remplacés explicitement. Les tests client/serveur exécutent les sources réelles avec des doublures explicites du SDK, de HTTP, de Supabase, des temporisateurs et des éléments audio. La construction des permissions est vérifiée ; cela ne constitue pas un test de signature JWT ou d'application des permissions par un serveur LiveKit réel.

Couverture ajoutée : double démarrage, réponse et connexion tardives, délais fetch/JSON/connexion, pistes audio seulement, pistes multiples, démontage, arrêt malgré une erreur de nettoyage, gains invalides, autorisation de lecture, reconnexion, refus d'accès, corps invalides, limites de taille, droits de publication et choix explicite de conversation.

**Ces essais ne sont pas un test de charge de 1 000 utilisateurs. Aucun téléphone physique, haut-parleur MUKTI, mesure de distorsion, test thermique ou effet biologique n'a été testé.**

## Architecture recommandée pour un public nombreux — non déployée ici

Objectif : un hôte transmet son contenu au service, qui le distribue aux auditeurs. Ne pas construire une connexion directe de l'appareil physique vers chaque téléphone et ne jamais lier le nombre d'auditeurs à la puissance acoustique de l'appareil.

- Contenu interactif : réutiliser LiveKit après dimensionnement et essais de la configuration réelle. Le benchmark officiel auto-hébergé impose que chaque salle tienne sur un nœud ; augmenter le nombre de nœuds ne rend pas automatiquement une salle unique illimitée.
- Contenus préenregistrés : étudier la distribution en cache/CDN et le préchargement avec contrôle d'intégrité, plutôt qu'un réencodage individuel à chaque écoute. Cloudflare R2 avec domaine personnalisé et règles d'accès est une piste, pas une configuration déjà active.
- Tonalités précises : envisager une génération locale à partir d'instructions validées ou des fichiers sans perte, dans les limites des appareils récepteurs. Aucune équivalence acoustique avec les enceintes du Salon n'est acquise.
- Accès public : créer un consentement explicite de l'hôte, une politique d'audience et une admission atomique. Ne pas rendre publics les cercles privés existants pour augmenter artificiellement les chiffres.
- Sans Wi-Fi/Bluetooth dans le matériel : une passerelle filaire connectée à Internet est nécessaire pour une émission en direct. Un appareil totalement déconnecté peut lire un programme enregistré, pas diffuser de nouvelles données.

Exemple de dimensionnement, non mesuré : 10 000 auditeurs à 192 kbit/s chacun représentent 1,92 Gbit/s et 864 Go par heure de données sortantes décimales, hors surcharge réseau. Ce n'est ni un devis ni la capacité démontrée du VPS.

Sources techniques consultées :
- https://docs.livekit.io/transport/self-hosting/benchmark/
- https://docs.livekit.io/frontends/build/authentication/
- https://developers.cloudflare.com/r2/buckets/public-buckets/

## Blocages et limites restantes

| Domaine | État / preuve nécessaire |
|---|---|
| Écoute seule dans les cercles SFU | IMPLÉMENTÉE, tests isolés réussis ; non déployée. |
| Smartphone réel / Safari / Android / casque / interruption par appel | NON TESTÉ ; essais de bout en bout requis. |
| Serveur LiveKit et base réels | NON CONNECTÉS dans les tests ; vérifier configuration, JWT, permissions, fermeture et révocation effectives. |
| Diffusion publique depuis Portable ou Salon | NON INTÉGRÉE au firmware ; passerelle, identité de l'appareil et publication du programme manquantes. |
| Milliers d'auditeurs sur une séance | NON VALIDÉ ; capacité, budget réseau, admission, supervision, charge et endurance nécessaires. |
| Limitations héritées | Capacité des cercles, requêtes limitées par IP, affichage de toute la liste des participants et règles d'accès conservés ; ce ne sont pas une infrastructure de diffusion de masse. |
| Audio fidèle / tonalités seules | NON MESURÉ ; le moteur de conversation existant reste configuré pour la voix et n'est pas présenté comme sans perte. |
| Autres voix/guidages locaux | NON AUDITÉS par cette passe ; la commande d'écoute seule ne constitue pas un arrêt global de tous les contenus de la page. |
| Matériel et échauffement | AUCUN essai physique ; aucun accroissement de puissance ou de commande d'appareil effectué. |
| Bénéfices thérapeutiques à distance | NON DÉMONTRÉS et non revendiqués. |

**Décision : conserver cette amélioration sur la branche d'audit. Un mode d'écoute volontaire est développé et testé ; la demande complète de diffusion mondiale depuis les appareils physiques reste partielle.**
