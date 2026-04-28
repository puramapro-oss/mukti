# MUKTI — Mobile Framework Decision (Capacitor vs Expo)

> Décision à prendre AVANT de bootstrap mobile. Impacte 100% du code mobile.

## Contexte

- **CLAUDE.md écosystème Purama** : default = **Expo + EAS** (cf §16 Mobile).
- **SHANTI** : a tranché pour **Capacitor 8 + live WebView** (validé par Tissma 2026-04-26, voir memory `shanti_gate_decisions.md`).
- **NIDRA** : également tranché pour **Capacitor** (memory `nidra_gate_decisions.md` 2026-04-28).
- **MUKTI** : **non tranché**. À décider.

## Options

### Option A — Capacitor 8 (live WebView)

**Stratégie** : l'app native est un container léger qui charge `https://mukti.purama.dev` en WebView, avec plugins natifs pour push, haptics, partage iOS, caméra, microphone.

**Pour MUKTI** :
- ✅ MAJ instantanées (pas de re-soumission stores pour update web)
- ✅ Code partagé 95% web ↔ mobile
- ✅ Cohérent avec SHANTI + NIDRA (autres apps wellness Purama)
- ✅ Build/CI léger (pas d'image Android Studio massive)
- ⚠️ AR Energy Mirror (caméra + 3D) demande accès natif → plugin custom OU iframe avec MediaPipe (déjà utilisé en web)
- ⚠️ Cercles audio LiveKit : marche en WebView mais perfs réduites vs natif
- ⚠️ Apple Review historiquement plus strict sur "WebView wrappers" (Guideline 4.0) — mais SHANTI et NIDRA ont validé cette approche

**Risque** : Apple Guideline 4.0 ("Minimum Functionality") peut rejeter si l'app paraît trop "site web emballé". MUKTI a beaucoup de features natives potentielles qui peuvent compenser.

### Option B — Expo 52 + EAS (natif)

**Stratégie** : app native React Native pure, écran par écran réécrit. Communication avec backend via REST.

**Pour MUKTI** :
- ✅ Convention default Purama (cohérent avec autres apps non-wellness)
- ✅ Performance native pour AR (caméra + 3D fluide)
- ✅ Performance native pour audio Cercles (LiveKit React Native SDK)
- ✅ Apple Review plus permissif sur apps natives
- ❌ Code à dédupliquer (web ↔ mobile divergents)
- ❌ MAJ = re-soumission Apple (1-3j) + Google (1-2j)
- ❌ Build/CI plus lourd (Xcode + Android Studio + EAS)
- ❌ Onboarding Tissma plus complexe (deux codebases à maintenir)

**Risque** : effort de duplication 3-6 semaines additionnelles. Risque divergence web ↔ mobile.

### Option C — Hybrid (Capacitor pour 1.0, Expo pour 2.0+)

**Stratégie** : ship Capacitor en 1.0 pour atteindre les stores rapidement. Si traction → réécrire en Expo natif pour 2.0.

**Pour MUKTI** :
- ✅ Time-to-market rapide (1.0 = 2-3 semaines)
- ✅ Apprentissage utilisateurs avant investissement gros natif
- ⚠️ Migration future = effort 3-6 semaines + risque régression UX
- ⚠️ Communication store : "redesign 2.0" doit être justifiable

## Recommandation

> **Option A — Capacitor 8** (cohérent SHANTI + NIDRA).

**Rationale** :
1. **Cohérence écosystème** : 3 apps wellness sur la même stack → maintenance simplifiée, talents partagés, design system cohérent.
2. **Time-to-market** : MUKTI 1.0 stores en 2-3 semaines vs 6-10 semaines Expo.
3. **MAJ continues** : permet de corriger rapidement les bugs UI sans re-soumission (critique pour app addiction support).
4. **Features natives** : MUKTI utilise déjà MediaPipe en WebView (`@mediapipe/tasks-vision`) pour la caméra. Le AR Energy Mirror MARCHE en Capacitor avec un plugin caméra + getUserMedia.
5. **Compromis perfs** : LiveKit Cercles = perf "OK" en WebView (testé en web), pas critique pour MVP. Si bottleneck → upgrade vers SFU en backend, pas client.

**Conditions de bascule Expo natif** :
- Si Apple Review rejet 4.0 répété (3+ rejets en différentes builds).
- Si signaux UX dégradés en production (FPS < 30 sur AR, latence audio > 200ms en Cercles).
- Si volume utilisateurs > 100K et besoin perf premium justifié.

## Plan d'exécution Capacitor (si décision Option A)

```bash
cd /Users/matissdornier/purama/mukti

# 1. Add Capacitor 8
npm i @capacitor/core@^8.3.1 @capacitor/cli@^8.3.1
npm i @capacitor/ios@^8.3.1 @capacitor/android@^8.3.1
npm i @capacitor/app @capacitor/haptics @capacitor/preferences \
      @capacitor/push-notifications @capacitor/share \
      @capacitor/camera @capacitor/microphone

# 2. Init Capacitor
npx cap init Mukti dev.purama.mukti

# 3. Configure (capacitor.config.ts) — voir template ci-dessous
```

**capacitor.config.ts MUKTI** (template) :

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const isLocal = process.env.CAP_LOCAL === "1";

const config: CapacitorConfig = {
  appId: "dev.purama.mukti",
  appName: "Mukti",
  webDir: ".next/standalone/public",
  server: isLocal
    ? { url: "http://localhost:3000", cleartext: true, androidScheme: "http" }
    : { url: "https://mukti.purama.dev", cleartext: false, androidScheme: "https" },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0A0014", // adapter selon design system MUKTI
    scheme: "mukti",
    limitsNavigationsToAppBoundDomains: false,
    handleApplicationNotifications: true,
  },
  android: {
    backgroundColor: "#0A0014",
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    Haptics: {},
    Preferences: { group: "dev.purama.mukti" },
    App: { iosScheme: "mukti" },
    Camera: {
      // AR Energy Mirror — permission contextuelle
      // Permission FR : "Mukti utilise la caméra pour visualiser ton champ d'énergie pendant les sessions AR Energy Mirror. Aucune image n'est enregistrée."
    },
  },
};

export default config;
```

```bash
# 4. Add platforms
npm run cap:add:ios   # = npx cap add ios
npm run cap:add:android   # = npx cap add android

# 5. Sync
npm run cap:sync   # = npx cap sync

# 6. Add scripts package.json (cf SHANTI/package.json)
```

## Plan d'exécution Expo (si décision Option B)

> Plus lourd. Voir CLAUDE.md `.claude/skills/purama-system/` pour la stack default Expo + détails.

Étapes :
1. Créer projet Expo séparé : `mkdir mukti-mobile && cd mukti-mobile && npx create-expo-app@latest --template`
2. Configurer EAS : `npx eas-cli@latest init`
3. Migrer chaque écran clé : login, dashboard, libération, cercles, AR mirror, AURORA OMEGA, COR.E.
4. Configurer Supabase auth avec SecureStore adapter (cf §16 CLAUDE.md mobile auth).
5. Implémenter LiveKit React Native SDK pour Cercles audio.
6. Implémenter AR avec `expo-camera` + `expo-gl` + Three.js.
7. EAS build + submit (3-7j premiers builds).

## Templates fastlane / GitHub Actions

> Une fois la décision prise (recommandée : Capacitor), copier les templates depuis SHANTI :

```bash
# Si Capacitor → réutiliser les templates SHANTI
cp -R /Users/matissdornier/purama/shanti/docs/mobile/fastlane \
      /Users/matissdornier/purama/mukti/fastlane

cp -R /Users/matissdornier/purama/shanti/docs/mobile/github-actions \
      /Users/matissdornier/purama/mukti/.github/workflows

# Adapter les valeurs :
#   - app.shanti → dev.purama.mukti
#   - shanti.purama.dev → mukti.purama.dev
#   - SHANTI_DEMO_* → MUKTI_DEMO_*
#   - fastlane/metadata/{android|apple} : run sync-to-fastlane.ts MUKTI

# Si Expo → utiliser EAS workflows (template différent dans skill purama-system)
```

## Décision finale

> **À acter par Tissma** dans une session courte (15 min) en lisant ce doc + comparant aux MEMORY decisions de SHANTI et NIDRA.

> Une fois actée → mettre à jour la memory : `mukti_gate_decisions.md` avec entrée "Mobile framework: Capacitor / Expo, raison: ...".

> Puis bootstrap effectif (1-2 sessions Claude Code dédiées selon framework choisi).
