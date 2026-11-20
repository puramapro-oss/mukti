# Correction des espacements — preuve navigateur

**PASS sur le lock définitif : 10 scénarios réussis, aucun échec ou retry, code retour 0.** Le scénario mobile avec assertions géométriques échouait avant la correction, code retour 1.

Le seul changement produit est le déplacement du reset universel dans `@layer base`. Les assertions mesurent les pixels rendus et les zones des commandes, sans comparer les noms de classes. Les mesures ci-dessous portent sur le même état de préparation, avec un viewport de 390 × 844 pixels.

| Mesure en pixels | Avant | Après |
|---|---:|---:|
| Padding haut de la section | 0 | 112 |
| Marge entre header et premier contenu | -48 | 44 |
| Padding latéral gauche / droite | 0 / 0 | 20 / 20 |
| Hauteur du bouton « Préparer le texte » | 22 | 46 |
| Hauteur du bouton « Commencer mon rituel » | 22 | 46 |

En lecture, l’espace sous le header est de 44 px ; les commandes Pause et Arrêter mesurent respectivement 46 et 46 px de haut. Le padding interne de ces deux commandes est de 12 px verticalement et de 16 px horizontalement.

Dernière qualification : 35.25 s, Chromium 147.0.7727.0 via @sparticuz/chromium 147.0.2, Playwright 1.59.1, PostCSS 8.5.29. Cette passe suit l’ajustement final de résolution PostCSS du banc. La distribution Chromium et le retrait documenté de --single-process sont inchangés entre les deux mesures.

Les captures finales mobile et desktop accompagnent ce rapport. Le JSON contient les mesures exactes, les versions effectivement installées, les commandes, les codes retour et les empreintes des captures. La baseline est conservée ; les traces brutes restent séparées et ne sont pas nécessaires pour copier cette preuve dans docs/evidence.

Limites : API simulées, aucun compte connecté, aucun backend réel ou déploiement. Le canvas WebGL est remplacé dans ce banc ; le graphe Web Audio et le MediaRecorder sont réels.
