# MUKTI — Pack post-SASU (activation stores + Stripe live)

> Tout ce qu'il faut pour passer de "MUKTI 100% prêt web" à "MUKTI live sur App Store + Google Play + Stripe production", à exécuter dès que la SASU PURAMA est immatriculée.

## État actuel

- ✅ **Web** : 137+ routes, 32 locales, 8 gates, 583 tests passent. Prod live `mukti.purama.dev`.
- ⏳ **Mobile** : code prêt à bootstrapper. Cf. `MOBILE_FRAMEWORK_DECISION.md` (Capacitor vs Expo).
- ⏳ **Stripe live** : Connect Embedded V4 codé en mode test ; passage live demande SASU active + KYC.

## Ordre d'exécution post-SASU

1. **Apple Developer Program** activé → cf. `APPLE_DEVELOPER_SETUP.md`.
2. **Google Play Console** activée → cf. `GOOGLE_PLAY_SETUP.md`.
3. **Stripe live mode** activé → cf. `STRIPE_LIVE_CHECKLIST.md`.
4. **Décision mobile framework** : Capacitor live-WebView ou Expo natif → cf. `MOBILE_FRAMEWORK_DECISION.md`.
5. **Bootstrap mobile** : cf. la décision prise au point 4 + le plan de session 3 dans `progress.md`.

## Sommaire des fichiers

| Fichier | Contenu | Délai estimé |
|---|---|---|
| [`APPLE_DEVELOPER_SETUP.md`](./APPLE_DEVELOPER_SETUP.md) | Apple Dev 99€/an + D-U-N-S + App Store Connect setup | 1-2 semaines (D-U-N-S) |
| [`GOOGLE_PLAY_SETUP.md`](./GOOGLE_PLAY_SETUP.md) | Play Console 25$ + Service Account + signing key | 24-48h |
| [`STRIPE_LIVE_CHECKLIST.md`](./STRIPE_LIVE_CHECKLIST.md) | KYC business + Connect activation + webhook prod | 2-7 jours |
| [`MOBILE_FRAMEWORK_DECISION.md`](./MOBILE_FRAMEWORK_DECISION.md) | Comparaison Capacitor (SHANTI) vs Expo (default) pour MUKTI | Décision à prendre avant code |

## Pré-requis communs (à avoir avant de démarrer)

- [ ] SIREN délivré INPI
- [ ] KBIS reçu (PDF officiel)
- [ ] RIB compte pro PURAMA SASU (Qonto / Shine / banque traditionnelle)
- [ ] Régime TVA confirmé (franchise art. 293B ou réel)
- [ ] Ligne téléphonique pro (Apple + Google demandent un numéro)
- [ ] CNI Tissma valide (KYC Stripe + Apple)

## Identifiants MUKTI à connaître

| Champ | Valeur |
|---|---|
| Bundle ID iOS / Package Android | `dev.purama.mukti` (convention Purama) |
| Domain | `mukti.purama.dev` |
| App name | `Mukti — Libération` |
| Category | Health & Fitness / Lifestyle |
| Default locale | French (France) |
| Locales supportées | 32 (fr + 31 autres) |
| Demo account | À générer juste avant submit (`demo@purama.dev`) |
| Press URL | (à créer si besoin similaire à `shanti.purama.dev/presse`) |
| Manifesto URL | (à créer si besoin similaire à SHANTI) |

## Différences clés MUKTI vs SHANTI

> Si tu connais déjà le pack SHANTI (`/Users/matissdornier/purama/shanti/docs/mobile/`), voici ce qui change pour MUKTI :

| Aspect | SHANTI | MUKTI |
|---|---|---|
| Positionnement | Soin holistique non-médical | **Expérience spirituelle** non-thérapeutique, non-scientifique |
| Apple Review notes | Wellness app, 5-axis diagnostic | **Spiritual + addiction support** — wording extra-prudent |
| Permissions sensibles | Push, haptics | **Caméra (AR Energy Mirror)** + push + haptics + microphone (Cercles audio) |
| Bundle | `app.shanti` (SHANTI-spécifique) | `dev.purama.mukti` (convention Purama default) |
| Locales stores | 30 | **32** |
| Pricing | 9,99 / 19,99 | **9,99 / 49,99 / 99,99** (per BRIEF VITAE §20.1, plans Essentiel/Infini/Légende) |
| Mobile framework | Capacitor (live WebView) | **À décider** (Expo natif probable) |

## Wording légal critique MUKTI

Pour les reviews Apple + Google, les notes doivent insister sur :

> *"MUKTI is a spiritual experience platform. It is NOT a medical device, NOT a therapeutic tool, NOT a scientific intervention. It supports addiction recovery through meditation, intentional circles, energy practices and conscious affirmations — none of which are presented as cures or treatments. In case of medical emergency, the app surfaces 112 (European emergency) immediately. Users sign explicit consent before any session. The app respects all DSA, RGPD, and App Store guidelines."*

À reprendre quasi-mot-à-mot dans les notes Apple Review et Google Play comments.

## Smoke post-go-live

```bash
# Apple
curl -sI "https://apps.apple.com/fr/app/mukti-liberation/id<APPLE_ID>" | head -1

# Google
curl -sI "https://play.google.com/store/apps/details?id=dev.purama.mukti" | head -1

# Stripe (compte live actif)
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/account | grep '"livemode"'
```
