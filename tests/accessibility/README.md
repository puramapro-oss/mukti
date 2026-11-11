# Vérification des contrôles d’accessibilité MUKTI

Cette recette vérifie les composants et fonctions réellement importés depuis `src/`. Elle ne constitue pas une compilation de l’application Next entière, un audit RGAA/WCAG complet, un test de lecteur d’écran, ni une preuve de déploiement.

## Commandes

`node --test tests/accessibility/preferences.test.mjs` vérifie la normalisation, les données anciennes, le stockage refusé, la synchronisation et les commandes de vibration (matériel simulé).

`node node_modules/typescript/bin/tsc -p tsconfig.accessibility.json` vérifie le typage des fichiers modifiés et de leurs imports locaux.

`node tests/accessibility/browser.mjs` compile les composants en SSR puis les hydrate dans Chromium. La recette vérifie les contrôles natifs au clavier, la conservation et la synchronisation des choix, les tokens de contraste, le mouvement réduit du système, le repli sans stockage, le texte à 200 %, la largeur de 320 px, les cibles de 44 px et les règles axe sélectionnées.

Le script utilise `esbuild`, `playwright`, `react`, `react-dom`, `typescript` et `axe-core`. La CI les installe dans un dossier temporaire, sans installer les dépendances de l’application et sans secrets. `A11Y_TOOLING_PACKAGE` permet de désigner le package JSON de cet environnement QA. `A11Y_BROWSER_EXECUTABLE` peut désigner un Chromium autorisé déjà installé. `A11Y_SSR_ONLY=1` exécute seulement le contrôle SSR, sans ouvrir un navigateur.

## Portée et conservation

La clé existante `mukti.a11y.prefs` et ses six champs sont conservés. La préférence `captionsForced` demeure dans les données anciennes, mais le commutateur sans consommateur identifié a été retiré de l’écran. Aucun sous-titrage automatique n’est ajouté.

Le contraste renforcé agit sur les tokens du thème ; les couleurs codées directement dans les autres composants restent à auditer. La réduction du mouvement agit sur les animations CSS et les hooks MUKTI raccordés. Les moteurs graphiques indépendants nécessitent leur propre validation.

Le test de vibration confirme une demande à l’API, jamais une sensation physique. La compatibilité VoiceOver, TalkBack, NVDA, contacteurs et appareils réels demeure une recette manuelle distincte. Les réglages audio, les parcours médicaux, les paiements et les systèmes de consentement ne sont pas modifiés par ce lot.
