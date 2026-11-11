# Vérification des contrôles d’accessibilité MUKTI

Cette recette vérifie les composants et fonctions réellement importés depuis `src/`. Elle ne constitue pas une compilation de l’application Next entière, un audit RGAA/WCAG complet, un test de lecteur d’écran, ni une preuve de déploiement.

## Commandes

`node --test tests/accessibility/preferences.test.mjs` vérifie la normalisation, les données anciennes, le stockage refusé, la synchronisation et les commandes de vibration (matériel simulé).

`node --test tests/accessibility/modal.test.mjs` monte le vrai composant `Modal` dans React et jsdom. Il vérifie le nom du dialogue avec ou sans titre, le nom de la fermeture, la région de lecture nommée accessible au clavier, l'événement natif `cancel`, l'absence de soumission accidentelle du formulaire, le retour du focus, la réouverture et StrictMode. Seules les méthodes natives `showModal` et `close`, absentes de jsdom, sont simulées ; ce test ne qualifie pas le confinement du focus d'un navigateur. `node --test tests/accessibility/*.test.mjs` exécute les deux suites.

`node node_modules/typescript/bin/tsc -p tsconfig.accessibility.json` vérifie le typage des fichiers modifiés et de leurs imports locaux.

`node tests/accessibility/browser.mjs` compile les composants en SSR puis les hydrate dans Chromium. La recette vérifie les contrôles natifs au clavier, la conservation et la synchronisation des choix, les tokens de contraste, le mouvement réduit du système, le repli sans stockage, le texte à 200 %, la largeur de 320 px, les cibles de 44 px et les règles axe sélectionnées. Le même harnais ouvre le véritable dialogue partagé au clavier, vérifie son nom, la cible de fermeture, Tab/Maj+Tab, Échap, le retour au déclencheur, la réouverture et le cas sans titre.

Le script utilise `esbuild`, `playwright`, `react`, `react-dom`, `typescript` et `axe-core`. La CI les installe dans un dossier temporaire, sans installer les dépendances de l’application et sans secrets. `A11Y_TOOLING_PACKAGE` permet de désigner le package JSON de cet environnement QA. `A11Y_BROWSER_EXECUTABLE` peut désigner un Chromium autorisé déjà installé. `A11Y_SSR_ONLY=1` exécute seulement le contrôle SSR, sans ouvrir un navigateur.

La recette du dialogue réutilise ses dépendances produit `lucide-react`, `clsx` et `tailwind-merge`, ainsi que `jsdom` et `@testing-library/dom` pour ses assertions DOM. Les versions sont épinglées dans le workflow existant ; aucune dépendance de l'application n'est ajoutée.

## Portée et conservation

La clé existante `mukti.a11y.prefs` et ses six champs sont conservés. La préférence `captionsForced` demeure dans les données anciennes, mais le commutateur sans consommateur identifié a été retiré de l’écran. Aucun sous-titrage automatique n’est ajouté.

Le contraste renforcé agit sur les tokens du thème ; les couleurs codées directement dans les autres composants restent à auditer. La réduction du mouvement agit sur les animations CSS et les hooks MUKTI raccordés. Les moteurs graphiques indépendants nécessitent leur propre validation.

Le test de vibration confirme une demande à l’API, jamais une sensation physique. La compatibilité VoiceOver, TalkBack, NVDA, contacteurs et appareils réels demeure une recette manuelle distincte. Les réglages audio, les parcours médicaux, les paiements et les systèmes de consentement ne sont pas modifiés par ce lot.

## Incrément du dialogue partagé — 11 novembre 2026

Base de reprise : `2ab63923e1dbc31adac428da0a7754d8092d68aa`, PR MUKTI nº 8. La scène statique AURORA lorsque les mouvements sont réduits est déjà présente dans cette base et reste intacte.

Les six nouveaux contrôles DOM ont échoué sur le composant avant correction, puis réussissent après correction. Le dialogue natif est conservé ; il reçoit un nom associé au titre ou un nom de repli, une fermeture toujours disponible et nommée, et une restauration du focus au déclencheur. Échap utilise l'événement `cancel` du dialogue au lieu d'un écouteur global au document. La fermeture ne soumet pas un formulaire parent. Le focus initial est posé après mémorisation du déclencheur : un attribut React `autoFocus` le déplaçait trop tôt et les deux tests de restauration l'ont détecté pendant la correction.

Les preuves locales DOM, typage et SSR ne valent pas un résultat navigateur. Dans l'environnement local de cette reprise, Chromium refuse de démarrer (`socket() failed: Operation not permitted`), avant tout scénario. La qualification du clavier natif reste à exécuter dans le job CI existant sur le commit publié.

### Contenu long et petit écran

La revue du vrai `ShareStoryButton` a identifié un second risque concret : son image (jusqu'à 460 px), ses textes et ses actions peuvent dépasser la fenêtre à 200 % de texte. La carte est maintenant bornée à la hauteur disponible, avec des espacements décoratifs en pixels, un en-tête qui reste visible et une région de contenu défilable au clavier. Le texte garde la taille choisie et peut revenir à la ligne. Le septième contrôle DOM, ajouté pour cette région, échouait avant son ajout et réussit ensuite.

Le même harnais importe le vrai `ShareStoryButton`, avec son image et ses commandes. À 320 × 640 puis 640 × 360 px et avec une police racine à 200 %, les scénarios vérifient les rectangles de la fermeture et de la dernière action, une région de lecture d'au moins 96 px, l'absence de débordement horizontal, le défilement avec Fin, l'accès à la dernière action avec Tab et le retour au déclencheur. Les mesures sont conservées dans `browser-report.json` et les captures dans `mukti-modal-*.png`.

Le chargement `/api/story/share` est intercepté dans Playwright et reçoit des données synthétiques ainsi qu'une image locale en URL de données. Aucun partage n'est déclenché, aucun endpoint produit n'est modifié et aucun service de partage n'est contacté. Ces mesures géométriques restent **NON TESTÉES localement** tant que le navigateur ne peut pas démarrer ; la compilation CSS et les tests DOM ne remplacent pas leur exécution en CI.
