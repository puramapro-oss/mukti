# Audit et corrections AURORA — 11 octobre 2026

État : corrections proposées pour revue, tests logiciels locaux exécutés ; aucune fusion ni mise en production.

- Dépôt : `puramapro-oss/mukti`.
- Base inspectée : `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Branche : `codex/mukti-aurora-lifecycle-20261011`.
- Périmètre : cycle de vie client AURORA, chronométrage, sorties audio/vibrations et confirmation de persistance.
- Les appels serveur et sorties physiques sont **SIMULÉS** dans les tests. Ce lot n'est ni **TESTÉ PHYSIQUEMENT**, ni **CERTIFIÉ**, ni une validation de tout MUKTI/PURAMA.

## Problèmes reproduits et corrections

La première série de 14 scénarios a échoué sur le code de base : 5 sur le moteur de phases, 4 sur l'audio, 5 sur l'intégration. Ces 14 scénarios ne représentent pas nécessairement 14 causes indépendantes. La suite a ensuite été étendue à 41 cas.

| Problème constaté | Correction | Preuve locale |
| --- | --- | --- |
| Une pause réintroduisait du temps dans le sous-cycle suivant ; un arrêt en pause comptait le temps de pause | Décalage des deux horloges à la reprise ; gel du temps lors de l'arrêt | Tests de phase avec horloge déterministe |
| La boucle d'animation continuait pendant la pause | Annulation du RAF et reprise unique | Aucun RAF en pause dans les tests |
| État de départ et première consigne d'une nouvelle phase incohérents | Initialisation immédiate et émission du premier sous-cycle | Tests démarrage et changement de phase |
| Le choix SOFT était enregistré sans modifier le moteur | Transmission du choix et retrait des rétentions du plan SOFT | Tests SOFT et CORE |
| Voix possible hors session, après arrêt ou malgré coupure audio | Conditions explicites d'émission ; annulation de la voix ; destruction idempotente | Tests du moteur audio |
| Double démarrage et reprise après une réponse réseau tardive | Verrous synchrones, génération d'exécution et AbortController | Tests interface, annulation et démontage |
| Pause sans coupure audio/vibration | Arrêt des sorties avant pause ; reprise explicite | Tests interface |
| Succès annoncé malgré une sauvegarde refusée | Validation de la réponse et message d'enregistrement non confirmé | Tests réponse 500 et sauvegarde |
| Démarrage sonore avant acceptation serveur | Préparation silencieuse pendant le geste ; activation après réponse valide | Test refus serveur et préparation silencieuse |
| Session poursuivie lors de la mise en arrière-plan | Pause sur visibilitychange, pagehide ou blur ; aucune reprise automatique | Test visibilité |
| Attente réseau ou reprise audio sans limite | Annulation réseau à 10 s ; délai audio à 5 s | Tests minuteries et réponses tardives |
| Score présenté comme une mesure respiratoire sans capteur | Libellé « Régularité du guidage » et « cycles guidés » | Revue du calcul et de l'interface |
| Durée CALM affichée 7 minutes alors que le plan totalise 468 secondes | Affichage arrondi à 8 minutes ; correction des commentaires de durée | Test des quatre variantes |

Le champ historique `coherence_score` reste compatible avec le serveur ; son calcul décrit le guidage logiciel. Il ne mesure ni respiration, ni rythme cardiaque, ni résultat clinique. Les durées et amplitudes existantes ne sont pas une prescription ni une qualification acoustique.

## Vérifications exécutées

Environnement : Node 24.19.0, npm 11.9.0, Vitest 5.0.3, React 19.2.4, jsdom 26.1.0.

| Vérification | Résultat | Portée |
| --- | --- | --- |
| Installation propre du verrouillage autonome, scripts désactivés | Réussie, 182 paquets installés | Environnement de tests uniquement |
| Vitest | 41/41 réussis, 4 fichiers | Code AURORA et interface, périphériques et serveur simulés |
| TypeScript strict ciblé | Réussi | Fichiers AURORA importés par la suite, dépendances de tests |
| `git diff --check` | Réussi | Espaces/format du diff, sans certification fonctionnelle |
| `npm audit --package-lock-only` du dossier de tests | 0 alerte au 11/10/2026 | Base npm consultée à cette date |
| Même audit du verrouillage principal | 32 paquets signalés : 5 critiques, 13 élevés, 13 modérés, 1 faible | Inventaire des dépendances, pas preuve d'exploitabilité |
| Installation complète de MUKTI | Échec | Dépendance Git privée SMARANA inaccessible par npm/Git dans cet environnement |
| Build/lint/typecheck complets et E2E authentifié | Non validés | Installation complète indisponible ; aucun test contre la production |
| Web Audio réel, WebGL, navigateur mobile, vibration, écoute | Non exécutés | Matériel et navigateur réel nécessaires |

Les extractions structurées des deux audits npm sont dans `docs/evidence/`. Les comptes correspondent à des paquets signalés, pas au nombre de CVE distinctes ni de failles exploitables dans MUKTI.

## Conditions avant intégration et déploiement

1. Rendre l'installation reproductible avec un accès de lecture Git autorisé à la révision verrouillée de `@purama/smarana`. Le connecteur GitHub peut lire le dépôt ; cela ne fournit pas automatiquement des identifiants à npm/Git. Aucun secret n'est à placer dans les fichiers du dépôt.
2. Fournir la configuration ESLint partagée réellement attendue : `file:../packages/eslint-config-purama`. Ce chemin est absent du checkout isolé. Ne pas substituer une configuration permissive pour annoncer un lint réussi.
3. Traiter et qualifier les alertes du verrouillage principal, en priorité Next (version verrouillée 16.2.11), Capacitor et leurs dépendances concernées. La version Next du banc de tests ne met pas à jour l'application. Certaines chaînes transitives n'ont pas de correction npm automatique ; un `npm audit fix --force` global n'a pas été appliqué.
4. Exécuter le build, le lint et le contrôle TypeScript complets avec le vrai graphe de production ; vérifier les routes de création/fin de session dans un environnement de test avec base dédiée, puis le parcours navigateur et mobile.
5. Vérifier les politiques réelles d'activation Web Audio, la perte de focus, l'annulation des vibrations et l'arrêt sonore sur les appareils visés. Aucun volume maximal ni effet thérapeutique n'est déduit d'un gain numérique ou d'une fréquence de synthèse.

L'annulation d'une requête client ne prouve pas son annulation côté serveur. Un POST interrompu peut laisser une session créée ; une réponse perdue peut suivre une écriture réussie. Les mutations ne sont pas rejouées automatiquement. Une stratégie serveur d'idempotence/réconciliation reste à qualifier avant une reprise automatique.

Le moteur suspend le guidage lorsque la page est masquée ; il ne rattrape pas plusieurs consignes manquées lors d'un blocage arbitraire du thread. Ce code n'est pas un contrôleur temps réel ni un dispositif de sécurité physique.

La branche de revue désactive son propre déploiement Vercel via `git.deploymentEnabled`. Les workflows mobiles existants ne ciblent que certains fichiers sur `main`. Aucun lancement manuel de workflow, fusion, achat, appel de modèle payant, migration de base ou commande physique n'a été effectué pour ce lot.

## Limites PURAMA

Ce lot réutilise MUKTI existant. Il ne crée aucune IA centrale, mémoire ou orchestration concurrente et ne modifie pas les travaux SUTRA/MIDAS. Il ne valide pas VISHVAKARMA, le robot, l'armure, les drones, les véhicules, les nanotechnologies ou les assemblages de matériaux. Ces projets conservent leurs exigences documentaires, analyses de risques, simulations adaptées et essais physiques propres.

## Reprise du 12 octobre 2026 — cohérence visuelle et rendu

Base de cette reprise : `8b675027667a8b5ecec990ab245c2cd6b9e5b302`, même branche et PR brouillon. Les 41 tests existants ont été rejoués avec succès avant modification. Aucun nouveau fichier livré ; les corrections et preuves complètent les fichiers existants.

Corrections :

- La pause remplace la consigne respiratoire affichée par un état explicite et retire le repère animé. La reprise rétablit les consignes.
- Démarrage, reprise, pause, arrêt, fin de session et enregistrement disposent de libellés distincts. L'état est annoncé par une zone `status`, sans y inclure un compteur mis à jour à chaque image.
- Un niveau serveur `null` affiche « Aucun niveau atteint » : le client n'invente plus le niveau « Brume ».
- Le Canvas reçoit `frameloop="demand"` hors session active, au lieu de garder sa boucle continue. Le contrôle ajouté concerne le rendu 3D ; la correction du 11 octobre portait sur la boucle du moteur de phases.
- La préférence de mouvements réduits sélectionne une scène fixe. Le chargement et le repère d'expiration respectent également cette préférence. Un visuel statique est fourni comme fallback Canvas ; la défaillance WebGL réelle n'a pas été reproduite.
- Le repère d'expiration n'est plus monté pendant l'inspiration ou la rétention. Sa description ne lui attribue plus d'effet neurologique établi.
- Les commandes principales peuvent revenir à la ligne ; les boutons de voix et particules exposent leur état sélectionné. Le placement aux différentes tailles d'écran reste à contrôler dans un navigateur réel.

Vérifications exécutées : 46 tests réussis sur 4 fichiers, TypeScript ciblé réussi et `git diff --check` réussi. Cinq scénarios ont été ajoutés : pause/reprise des consignes, arrêt/enregistrement/niveau absent, fin de session avec sauvegarde refusée, bascule rendu continu/à la demande, changement de préférence de mouvements réduits avec nettoyage des abonnements. Le banc a reçu un alias vers sa dépendance r3f déjà verrouillée, sans nouvelle dépendance.

Limites : Canvas/WebGL, audio, vibration et serveur sont remplacés dans le banc. Il n'y a pas de mesure FPS, thermique ou énergétique, de validation visuelle sur téléphone, de build complet, de déploiement ou de test physique. Les blocages de production listés plus haut restent ouverts ; cette reprise ne les clôture pas.

Référence technique consultée le 12 octobre 2026 : documentation officielle React Three Fiber, « Scaling performance », rendu à la demande et invalidation sur changement de propriétés : https://r3f.docs.pmnd.rs/advanced/scaling-performance . Cette documentation justifie le mécanisme choisi, pas un gain mesuré sur les appareils PURAMA.
