# Régressions AURORA

Tests locaux du code AURORA réel, avec réseau, audio, vibrations et rendu 3D simulés. Aucun compte, secret, service payant, serveur MUKTI ni appareil physique n'est utilisé.

## Exécution reproductible

Node >= 22.12 est requis. Vérifié avec Node 24.19.0 et npm 11.9.0.

```sh
cd tests/aurora-regression
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm audit --package-lock-only
```

Après installation, `npm run test:aurora` fonctionne aussi depuis la racine du dépôt. Le verrouillage de ce dossier est autonome : il ne remplace pas celui de l'application.

`.npmrc` désactive la résolution automatique des pairs : cette suite web utilise React 19.2.4 et ne doit pas installer la pile native optionnelle Expo/React Native des composants 3D. Les dépendances nécessaires sont déclarées explicitement et verrouillées. Les scripts d'installation sont désactivés ; l'installation propre et les tests ont été exécutés avec cette configuration.

## Couverture et limites

| Fichier | Cas | Vérification |
| --- | ---: | --- |
| `phase.test.tsx` | 13 | Horloge, pauses, arrêt, changements de phase, SOFT, durée des quatre variantes |
| `audio.test.ts` | 9 | Activation, silence, synthèse vocale, destruction, reprise tardive, paramètres invalides, délai audio |
| `session.test.tsx` | 19 | Contrôles réels, double clic, réponses API, arrêt, arrière-plan, reprise tardive, sauvegarde, états visibles, politique de rendu et mouvements réduits |
| `api.test.ts` | 5 | Forme JSON, annulation préalable, réponse tardive après annulation |

Le contrôle TypeScript couvre les fichiers testés et leurs imports AURORA transitifs. Les dépendances publiques de cet environnement, notamment Next 16.4.0, sont séparées de celles de production. Ce contrôle ne prouve donc pas le build complet avec le verrouillage de production.

Le `fetch` par défaut lève une erreur si un test ne le simule pas explicitement. Les composants 3D, les sorties audio et les vibrations sont remplacés dans les tests d'interface. Le moteur audio est testé séparément avec une API Web Audio simulée. Aucun résultat n'établit un niveau acoustique, un effet physiologique ou une compatibilité matérielle réelle.

Résultat du 11 octobre 2026 : **41 tests réussis**, TypeScript ciblé réussi, zéro alerte npm dans ce verrouillage de tests à cette date. Consulter `../../docs/AURORA_AUDIT_2026-10-11.md` pour les blocages de l'application complète.

Reprise du 12 octobre 2026 : **46 tests réussis** et TypeScript ciblé réussi. Les 5 scénarios ajoutés vérifient la cohérence des états affichés et les transitions de politique de rendu. Le composant Canvas r3f reste remplacé : ces tests vérifient la demande de rendu continu/à la demande, pas le débit d'images ni la consommation GPU réelle. Aucun nouvel audit npm, test navigateur réel ou essai matériel n'est compris dans cette reprise.
