# Dépendances — vérification du 10 novembre 2026

**Statut : PARTIEL.** Les mises à jour ciblées sont installées. Les 13 paquets encore signalés en production, dont deux critiques, empêchent de déclarer le socle entièrement assaini. Les nombres ci-dessous sont ceux de `npm audit` par paquet, incluant les dépendances affectées indirectement ; ils ne représentent pas un nombre de CVE indépendantes.

## Résultats conservés

| Périmètre | Avant | Après | Résultat de commande après |
| --- | --- | --- | --- |
| Production, `--omit=dev` | 29 : 5 critiques, 8 élevées, 15 modérées, 1 faible | 13 : 2 critiques, 1 élevée, 9 modérées, 1 faible | exit 1 : alertes restantes |
| Harness de régression, toutes dépendances | 3 : 1 critique, 1 élevée, 1 modérée | 0 | exit 0 |

Rapports bruts inchangés : [production avant](evidence/npm-production-audit-2026-11-10.json), [harness avant](evidence/npm-regression-audit-2026-11-10.json). Nouveaux rapports : [production après](evidence/npm-production-audit-after-2026-11-10.json), [harness après](evidence/npm-regression-audit-after-2026-11-10.json).

## Versions retenues

| Dépendance directe | Avant | Version exacte après |
| --- | --- | --- |
| Next.js | lock racine 16.2.11 ; harness 16.4.0 | 16.4.6 dans les deux |
| Zod | 4.3.6 dans les deux | 4.6.7 dans les deux |
| SDK Anthropic | 0.82.0 dans les deux | 0.91.1 dans les deux |
| Capacitor Android / iOS | 7.6.2 | 7.6.9 |
| Capacitor core / CLI | déclaration racine `^7.6.2` | 7.6.9, alignés avec Android/iOS |
| eslint-config-next | déclaration racine 16.2.2 | 16.4.6 |

Corrections transitives obtenues dans les plages déclarées par leurs parents : `@xmldom/xmldom` 0.9.12 ; `brace-expansion` 1.1.21 et 5.0.12 ; `fflate` 0.8.3 et 0.6.11 ; `moment` 2.31.0 ; `nanoid` 3.3.20 ; `source-map-js` 1.2.2 ; `rimraf` 6.1.4. Cette dernière version demande elle-même `glob ^14.0.3`, résolu en 14.0.4 avec `minimatch` 11.0.5. Next fournit PostCSS 8.5.23 et une plage corrigée de sharp. Aucun override de major supplémentaire n'a été ajouté.

Les [métadonnées du registre](evidence/npm-candidate-metadata-2026-11-10.json) confirment la disponibilité et les peer dependencies des versions directes. Dans le harness, Playwright 1.59.1, Vite 8.3.4 et React 19.2.4 restent inchangés. La dépendance privée smarana conserve le commit vérifié `6b97a377fd17022286e88ab8e09be1e9bceb4ada`.

La qualification finale du harness a ensuite détecté une incompatibilité de types entre les copies PostCSS 8.5.23 et 8.5.29. `postcss@8.5.29` est déclaré explicitement dans ses dépendances de développement pour aligner Vite et Tailwind ; Next garde sa dépendance exacte 8.5.23. L'installation, le contrôle TypeScript incluant le banc navigateur et le nouvel audit du verrouillage ont terminé avec exit 0. Aucun cast ni retrait de fichier du contrôle TypeScript n'a été utilisé. Cette résolution ne modifie pas le verrouillage de production.

## Sources vérifiées

- Next.js : [avis de l'éditeur](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), corrigé à partir de 16.4.1 ; [publication 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6).
- Zod : [advisory et plage corrigée à partir de 4.6.6](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) ; [correctif source des contrôles de taille avant parcours](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd).
- Anthropic : [avis de l'éditeur, correctif 0.91.1](https://github.com/anthropics/anthropic-sdk-typescript/security/advisories/GHSA-p7fg-763f-g4gf). Il concerne l'outil mémoire sur disque ; les usages applicatifs inspectés sont `messages.create` et `messages.stream`.
- Capacitor : [avis de l'éditeur, branche 7 corrigée en 7.6.9](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv).
- Les références détaillées des autres alertes, leurs plages et leurs chemins installés figurent dans les rapports JSON avant/après.

## Limite OpenTimestamps

Les 13 paquets restants sont `javascript-opentimestamps`, `bitcore-lib`, `bitcore-message`, `bn.js`, `elliptic`, `lodash`, `qs`, `request`, `request-promise`, `request-promise-core`, `tough-cookie`, `uuid` et `web3`. Les niveaux critiques concernent les versions installées d'elliptic et lodash dans ce graphe ancien. L'exploitabilité dans l'application n'a pas été qualifiée par cet audit de dépendances.

Le paquet est utilisé : `src/lib/contests-karma.ts` appelle `stampHash` pour conserver une preuve. Son retrait modifierait cette fonction. Le [projet officiel](https://github.com/opentimestamps/javascript-opentimestamps) a renommé le paquet en `opentimestamps` à partir de 0.4.6. Son successeur publié 0.4.9 conserve toutefois `request`, `request-promise` et bitcore ; bitcore 8.25.47 demande notamment `bn.js =4.11.8` et elliptic. Un simple renommage ne constitue donc pas un assainissement complet. Le remplacement, la compatibilité des preuves existantes et la vérification cryptographique exigent une migration fonctionnelle dédiée. Ces dépendances et le comportement applicatif ont été conservés.

## Commandes réellement exécutées

Depuis `tests/aurora-regression` :

```sh
NODE_OPTIONS=--max-old-space-size=512 npm install --save-dev --save-exact next@16.4.6 zod@4.6.7 @anthropic-ai/sdk@0.91.1 --ignore-scripts --no-audit --no-fund --maxsockets=2
NODE_OPTIONS=--max-old-space-size=512 npm audit --json --maxsockets=2
```

Depuis la racine, après modification des huit versions directes dans `package.json` :

```sh
GIT_CONFIG_COUNT=3 \
GIT_CONFIG_KEY_0=url.file:///workspace/scratch/0aea786cb4d6/dependency-cache/smarana.git.insteadOf \
GIT_CONFIG_VALUE_0=ssh://git@github.com/puramapro-oss/purama-smarana.git \
GIT_CONFIG_KEY_1=url.https://github.com/.insteadOf \
GIT_CONFIG_VALUE_1=ssh://git@github.com/ \
GIT_CONFIG_KEY_2=protocol.file.allow GIT_CONFIG_VALUE_2=always \
NODE_OPTIONS=--max-old-space-size=512 \
npm update @anthropic-ai/sdk @capacitor/android @capacitor/ios @capacitor/core @capacitor/cli next eslint-config-next @xmldom/xmldom brace-expansion fflate moment nanoid source-map-js rimraf --ignore-scripts --no-audit --no-fund --maxsockets=2
NODE_OPTIONS=--max-old-space-size=512 npm audit --omit=dev --json --maxsockets=2
```

Les sorties ont été redirigées vers les rapports JSON et journaux d'installation dans `docs/evidence`. Les deux installations ont terminé avec exit 0, séquentiellement, sans `audit fix --force`.

**PASS :** [cinq contrôles locaux légers](evidence/dependency-smoke-2026-11-10.json) — rejet précoce Zod, présence des API Anthropic utilisées sans requête, encodage/lecture PNG par le binaire sharp installé, aller-retour ZIP fflate, SHA smarana inchangé. Ces contrôles n'ont envoyé aucune requête applicative.

**NON TESTÉ dans ce lot :** build et typecheck complets, compilation Android/iOS, opérations Anthropic réelles et ancrage/vérification blockchain. La qualification applicative consolidée est réalisée séparément après intégration. Aucun déploiement ni modification distante n'a été effectué.
