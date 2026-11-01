# MUKTI — audit ciblé du lecteur de tonalités, 1er novembre 2026

## Périmètre et résultat

**PASS pour la correction et les contrôles logiciels décrits. PARTIEL pour le produit complet. NON TESTÉ pour les deux appareils physiques et leurs effets. Aucun déploiement réussi revendiqué.**

- Branche : `audit/mukti-hardware-compat-20261023`.
- Départ vérifié : `3cdd012fc5e20195618d0fc1d2d4f94f9c0eac40`.
- Code corrigé et contrôlé : **`e1b91653b87a42f036d5196de5afdb368d27e8e2`**.
- `main` relue inchangée : `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Seuls le lecteur `src/lib/pure-tone-player.ts` et son fichier de tests ont été modifiés avant cet ajout documentaire.
- Fréquences, durées, gains, partage, autres modes, dépendances et configuration de déploiement inchangés. Aucun nouvel abonnement, service payant ou composant demandé.

## Défauts effectivement reproduits

Un abonné aux notifications d'état du lecteur peut appeler immédiatement arrêt, destruction ou remplacement de la lecture depuis la notification elle-même.

1. Pendant la notification de démarrage, une annulation pouvait être suivie de la création d'un temporisateur de cinq secondes et d'une tentative de reprise du contexte déjà fermé. La sortie était ensuite empêchée par les autres gardes, mais des travaux inutiles restaient créés après l'arrêt.
2. Pendant la notification de lecture, un arrêt ou un remplacement immédiat pouvait encore laisser la promesse du démarrage initial retourner `true`. Cela ne décrivait plus correctement l'état de cette tentative.

Le correctif revérifie l'identité de la tentative immédiatement après chaque notification concernée. Une tentative annulée n'alloue plus de délai ni de reprise audio supplémentaire ; elle ne revendique pas la réussite de sa remplaçante. Les gardes préexistantes restent en place.

Ces défauts sont reproduits par injection de callbacks synchrones. Aucun incident utilisateur réel n'a été observé ou revendiqué.

## Tests locaux exécutés

Environnement : Node 22.16.0, TypeScript 5.8.3, Chromium 144.0.7559.96.

| Contrôle | Résultat |
|---|---:|
| Suite tonalités/routes avant ajout des tests | 64 PASS, 0 échec |
| Suite étendue avant correction | 65 PASS, 7 échecs |
| Suite étendue après correction | **72 PASS, 0 échec** |
| Nouveaux scénarios | 8, dont 7 échouaient avant correction |
| TypeScript strict des deux modules autonomes | PASS |
| Rendus numériques OfflineAudioContext | **25 PASS** |
| Scénarios avec AudioContext réel dans Chromium muet | **6 PASS** |

Les 72 tests comprennent 65 tests du lecteur/format et 7 tests d'isolation de route. Les huit nouveaux cas sont déjà inclus. Le scénario répétant cent annulations compte pour un seul test.

Les 25 rendus comprennent les sept tonalités à 44,1, 48 et 96 kHz (21 cas), un rendu à gain nul, puis trois cas d'arrêt/coupure/réactivation et de plafond de gain. La fréquence estimée reste à moins de 0,01 Hz de sa cible dans ces rendus ; les seuils de vérification n'ont pas été relâchés. Ces mesures concernent un signal numérique, pas la précision d'un convertisseur physique.

Les six scénarios AudioContext utilisent le vrai moteur du navigateur avec sortie muette et requêtes réseau bloquées : arrêt/destruction au démarrage, arrêt/destruction à la notification de lecture, et remplacement dans chacun de ces deux moments. Les tentatives annulées retournent `false`, les remplaçantes volontaires aboutissent et les contextes sont fermés.

Commandes locales :

- `node --test work/tests/aurora-regression/pure-tone-regression.mjs work/tests/aurora-regression/tone-route-regression.mjs` avec résolution de TypeScript documentée dans l'archive.
- `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler` sur les modules tonalité et lecteur.
- `node compile-render.cjs`, puis les trois scripts Python de rendu et de cycle de vie fournis dans l'archive de preuves.

## Vérifications GitHub après intégration

Même commit `e1b91653b87a42f036d5196de5afdb368d27e8e2` :

- Run **41262536544**, job **124718553676** : suites React, Node, écoute seule, tonalités, typage du banc, différences Git et audit du banc — **success**.
- Même run, job **124718553869** : PostgreSQL jetable — **success**.
- Même run, job **124718553874** : audit applicatif au seuil élevé — **success**.
- Run **41262536511**, job **124718553601** : installation complète, intégrité de l'archive d'horodatage, tests d'horodatage et de compatibilité, TypeScript global, ESLint, compilation et audit strict des dépendances au seuil faible — **success**.

https://github.com/puramapro-oss/mukti/actions/runs/41262536544
https://github.com/puramapro-oss/mukti/actions/runs/41262536511

Ces résultats ont été relus dans les résumés détaillés des étapes après leur achèvement. Les nombres de tests locaux ci-dessus proviennent des journaux effectivement exécutés localement ; aucun nombre supplémentaire n'est inventé à partir des seuls résumés GitHub.

## Publication et limitations

Le statut tiers **Vercel renvoie `failure`**, avec un lien d'aide « deployment blocked ». La cause précise n'a pas été diagnostiquée et aucun contournement ni paiement n'a été entrepris. `vercel.json` conserve le déploiement désactivé pour cette branche. Ne pas confondre les jobs GitHub Actions réussis avec la réussite de tous les services externes ou un déploiement.

**NON TESTÉ** : casque ou enceinte réelle, téléphones iOS/Android réels, niveau acoustique, ultrasons, firmware, matériaux, assemblage des deux prototypes, endurance et thermique. Aucun essai de charge à des milliers d'utilisateurs ni mesure de coût d'exploitation n'a été réalisé. Aucun effet biologique, clinique, de purification ou de traitement à distance n'est établi par ces résultats.

**PARTIEL / BLOQUÉ pour une vente comme appareil final qualifié** : les références matérielles définitives, les plans, la liaison filaire autonome, la qualification physique et les exigences de conformité restent ouvertes. Cette intervention n'est ni un kit de fabrication ni une certification.

## Intégrité des fichiers contrôlés

- Lecteur corrigé : blob Git `e9a7b3cff285377c5624e5279958b18ff88fd68a`.
- Suite étendue : blob Git `142fbd1fdffc9695872fea385dcad97419cb5386`.

Ces identifiants ont été comparés aux contenus locaux et relus depuis GitHub. L'archive de preuves remise contient les journaux avant/après, les résultats JSON, les scripts de rendu, les sources sélectionnées, la différence du lecteur et un manifeste SHA-256. Elle ne contient aucun secret, aucune dépendance privée ni l'application entière.
