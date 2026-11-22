# Affirmations sur l’écran du téléphone — MUKTI

## Périmètre et continuité

Le catalogue et les parcours d’affirmations existaient déjà dans MUKTI. Cette
extension ajoute leur affichage natif sur le téléphone et leur configuration dans
le même espace, sans nouvelle application, table, banque de textes ou service IA.

Base de travail : `cdb9c2c6b3cda70141b0fc0d4f813d6d81a77089`, branche
`codex/aurora-timing-reliability-20261110` (PR #4). Elle conserve les travaux de
continuité, de journal et d’AURORA de cette branche. Les modifications locales
indépendantes du checkout principal ne sont pas incorporées implicitement.

La reprise du 12 novembre 2026 prolonge la PR #8 existante, à partir de
`6b863eb9476819fb55b19e2db408a8b6dec89ca9`. Cette branche réunit déjà les
affirmations natives, Harmonie et les préférences d’accessibilité. Les 54 fichiers
propres au widget avaient conservé les mêmes blobs entre les PR #5, #6 et #8 ;
aucune nouvelle application, branche publique concurrente ou copie du catalogue
n’est nécessaire pour cet incrément.

| Élément | Intégration |
| --- | --- |
| Accès utilisateur | Carte dans `/dashboard/subconscient` |
| Réglages | `/dashboard/subconscient/ecran-verrouille` |
| Catalogue | Table existante `mukti.affirmations`, lignes actives `source=purama` |
| API | `GET /api/affirmations/widget`, session vérifiée, client RLS, réponse privée sans cache |
| iPhone | Extension WidgetKit : écran verrouillé rectangulaire, accueil petit/moyen |
| Android | AppWidget natif ; accueil et écran verrouillé lorsque le système l’autorise |
| Persistance | Cache local `affirmationWidget.v1`, aucune nouvelle écriture en base |

## Comportement livré dans le code

L’utilisateur choisit un thème, la langue du catalogue et de 1 à 30 phrases
publiques courtes. Il peut mélanger les thèmes. Changer la langue ne traduit pas
silencieusement la sélection ; sélectionner une autre traduction du même ID
remplace celle qui était choisie. Les textes équivalents après normalisation
Unicode NFKC et passage en minuscules ne sont pas ajoutés en double.

Deux rythmes partagent la même règle de calcul sur le web, iOS et Android :

- **Chaque jour** : rotation à partir du jour civil local.
- **Trois moments** : transitions prévues à 07:00, 13:00 et 20:00 ; avant 07:00,
  la phrase du soir précédent reste sélectionnée.

Le fuseau courant du téléphone est utilisé. Les changements d’heure ne sont pas
modélisés comme des journées fixes de 24 heures. Le système d’exploitation garde
la maîtrise de l’actualisation : ces horaires ne constituent pas une alarme exacte.

Une sélection enregistrée est relue depuis le bridge avant de confirmer le
succès. L’effacement est également relu et vérifié. Les opérations ont une durée
bornée et un double appui ne lance pas deux sauvegardes simultanées. Un résultat
incertain ne devient jamais une confirmation d’enregistrement.

Le widget utilise ensuite le cache hors connexion. Cela ne rend pas l’éditeur
web ou le catalogue réseau disponibles hors connexion. L’installation du widget
sur l’écran reste une action de l’utilisateur, distincte de l’enregistrement.

## Récupération et état de l’édition

L’éditeur distingue le brouillon affiché et la dernière sélection relue sur le
téléphone. Une modification du rythme, du texte ou de l’ordre des phrases est
signalée ; un enregistrement identique ne lance pas une nouvelle écriture. Le
bouton de restauration reprend le dernier snapshot vérifié sans modifier le
téléphone. Ce brouillon reste en mémoire pendant l’édition : il ne constitue pas
une nouvelle sauvegarde automatique ni un nouveau stockage des préférences.

Les erreurs du catalogue et du téléphone restent distinctes. Une actualisation du
catalogue ne masque pas un échec natif et ne remplit pas une sélection volontairement
vidée. Cette protection s’applique aussi à la réponse tardive du catalogue initial.
Une connexion native peut être réessayée depuis la page ; elle conserve les choix
en cours. Une première lecture récupérée ne restaure le cache que si l’utilisateur
n’a pas encore fait de choix délibéré.

Le retour au premier plan relit l’état natif sans remplacer le brouillon. Si une
écriture est en cours, cette relecture est différée jusqu’à sa fin. Les écouteurs
sont retirés à la fermeture, y compris si leur inscription se termine tardivement.
Une actualisation manuelle de l’état reste disponible.

Une opération non confirmée affiche **« État enregistré à vérifier »**, même si la
dernière sélection connue correspond encore au brouillon. Une suppression peut en
effet réussir avant que sa relecture échoue. L’interface n’annonce alors ni une
sélection à jour, ni la présence actuelle d’un widget.

### Ajout Android depuis l’application

Après un enregistrement vérifié, le bouton d’ajout appelle le `requestPin()` natif
déjà présent. Il est disponible sur Android, pour une sélection enregistrée sans
modification en attente et sans widget déjà signalé comme présent. Le retour
`requested: true` signifie seulement que la demande a été envoyée au système ;
l’utilisateur confirme ensuite l’ajout. Seule une relecture de `installed` permet
d’afficher la présence du widget. Une réponse invalide est refusée et un lanceur
sans ajout direct conserve le parcours manuel depuis ses widgets.

### Accessibilité de l’éditeur

Les tailles de texte sont relatives et reprennent la préférence MUKTI existante.
La disposition s’adapte à la place disponible, y compris dans le conteneur du
dashboard. L’aperçu grandit avec son texte, sans masquer la phrase par sa légende.
Le contraste renforcé utilise les mêmes attributs de préférence que l’application,
avec des couleurs adaptées aux thèmes clair et sombre ; les couleurs forcées du
système gardent des repères de sélection et de focus.

Après retrait d’une phrase, le focus passe à la commande voisine ou au titre de la
sélection. Après une opération native déclenchée au clavier, il rejoint le statut
ou l’erreur. Cela couvre aussi une demande d’ajout lente, dont le bouton est
temporairement désactivé. Aucun nouveau panneau d’accessibilité n’est créé.

## Données et limites de confiance

Le snapshot contient seulement la version du format, le rythme, les IDs et textes
sélectionnés et la date de configuration. Il ne contient ni session, ni token,
ni journal, ni affirmation personnelle. Aucun appel IA et aucune permission de
notification ou d’alarme exacte ne sont ajoutés pour faire tourner le widget.

Le serveur ne lit pas `affirmation_custom`. Les bridges acceptent uniquement la
page à l’origine HTTPS exacte `mukti.purama.dev`, et revalident la taille, les
champs, les types, les caractères et les doublons. La validation structurelle
n’est pas une signature cryptographique de l’appartenance au catalogue.

La limite est de 100 points de code Unicode par phrase et 20 Kio pour le snapshot.
Les contrôles invisibles dangereux et les directions forcées sont refusés ; les
emojis valides, y compris les séquences ZWJ, restent utilisables. Les textes
composés et décomposés sont conservés sans réécriture du contenu affiché.

Les liens entrants sont restreints à la destination prévue. Sur iOS,
`mukti://affirmations` ouvre la route fixe des réglages ; les URL comportant une
autre destination, des paramètres ou un fragment sont ignorées. Sur Android,
l’intention explicite du widget mène à la même route sur l’origine autorisée.
L’authentification normale de MUKTI continue de s’appliquer.

## Builds et installation reproductible

Les sources versionnées résident dans `native/affirmations`. Les projets générés
`ios/` et `android/` restent régénérables et ne remplacent pas ces sources.

Le workflow mobile existant applique les installateurs après `cap sync` :

```sh
python3 scripts/widgets/apply-android.py
python3 scripts/widgets/apply-android.py --check
ruby scripts/widgets/apply-ios.rb
```

Les installateurs préservent les éléments existants et refusent les conflits avec
des fichiers gérés modifiés localement. Leur application répétée ne doit pas
dupliquer les cibles, les ressources, les schémas de lien ou les permissions.

Le [banc natif](../native/affirmations/harness/README.md) utilise les mêmes
installateurs avec Capacitor 7.6.2 et Capacitor App 7.1.2 verrouillés. Son workflow
PR compile l’hôte Android et le widget, puis l’application iOS et son extension
embarquée, sans certificat de livraison. Il ne publie pas sur les stores.

Sur iOS, les profils signés des deux identifiants `dev.purama.mukti` et
`dev.purama.mukti.affirmations` doivent autoriser l’App Group
`group.dev.purama.mukti.affirmations`. Une compilation de simulateur ne prouve
pas cette configuration de signature.

## Vérifications reproductibles

```sh
cd tests/aurora-regression
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run test:browser -- widget.browser.spec.ts
```

Depuis la racine :

```sh
sh native/affirmations/android/tests/run-model-tests.sh
python3 -W error::ResourceWarning native/affirmations/android/tests/test_apply_android.py
swiftc native/affirmations/ios/Shared/*.swift native/affirmations/ios/tests/main.swift -o /tmp/mukti-affirmations-tests
/tmp/mukti-affirmations-tests
ruby native/affirmations/ios/tests/installer_test.rb
```

Le banc web utilise des données synthétiques et des doubles explicites du serveur
et du bridge. Il vérifie les erreurs, la récupération, les traductions, les liens,
la sauvegarde relue et les courses entre requêtes. Le banc navigateur monte aussi
le véritable `AccessibilityPreferencesRoot` et sa feuille de style : il vérifie le
texte à 200 %, les largeurs de 320 et 640 pixels avec la marge du dashboard, les
cibles tactiles, le focus après retrait et les états natifs simulés. Ces scénarios
ne demandent aucune permission de microphone. Les tests Foundation/Java
exécutent le véritable modèle natif et ses règles calendaires ; les installateurs
sont testés sur de vrais projets générés ou fixtures Xcode. Ces preuves ont des
périmètres différents et ne remplacent pas un essai de bout en bout sur appareil.

Lors de cette reprise, l’indexation GitNexus actuelle n’a pas terminé dans ses deux
fenêtres de 120 secondes. Les impacts ont été demandés avant édition ; l’index
historique ne fournit pas de couverture actuelle des appelants et son risque reste
`UNKNOWN`. La lecture des sources de PR #8 confirme le périmètre direct : bridge,
hook, éditeur et route unique de configuration. Les tests et le diff complètent
ce contrôle ; ils ne transforment pas cette limite du graphe en résultat réussi.

Avant livraison mobile : vérifier le catalogue authentifié réel, l’enregistrement
via le bridge, l’ajout du widget, les liens à froid et à chaud, l’affichage hors
connexion après redémarrage, l’effacement, le texte agrandi et les changements de
date/fuseau. Vérifier la signature App Group sur iPhone et les surfaces réellement
disponibles sur chaque Android ciblé. Ne pas annoncer « déployé » sur la seule
présence de ces fichiers ou d’un workflow.

## Références officielles

- [Apple : actualisation des widgets](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [Apple : widgets accessoires](https://developer.apple.com/documentation/widgetkit/creating-accessory-widgets-and-watch-complications)
- [Android : widgets avancés](https://developer.android.com/develop/ui/views/appwidgets/advanced)
- [Android : ajout d’un widget depuis l’application](https://developer.android.com/develop/ui/views/appwidgets/discoverability)
- [Capacitor 7 : cycle de vie de l’application](https://capacitorjs.com/docs/v7/apis/app)
- [Capacitor 7 : code iOS](https://capacitorjs.com/docs/v7/ios/custom-code)
- [Capacitor 7 : code Android](https://capacitorjs.com/docs/v7/android/custom-code)
- [W3C : agrandissement du texte](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [W3C : redistribution du contenu](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
