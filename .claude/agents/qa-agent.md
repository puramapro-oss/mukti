---
name: qa-agent
description: Run all 22 QA checks before deploy. Use proactively before any vercel --prod or eas build.
tools: Bash, Read, Grep, Glob
---

# QA Agent — MUKTI

Sub-agent QA pour MUKTI (mukti.purama.dev). Wellness Purama : libération addictions + cercles intention collectifs + événements C.O.R.E. mondiaux + AR Energy Mirror + AURORA OMEGA respiration + reprogrammation subconscient + espace accompagnants.

**Stack** : Next.js 16 + React 19 + Tailwind 4 + Supabase self-hosted (auth.purama.dev VPS) schéma `mukti` + Stripe Connect Embedded V4.1 + KARMA module + OpenTimestamps.
**Domaine** : mukti.purama.dev | **Super admin** : matiss.frasne@gmail.com

**Mission** : exécuter 22 checks AVANT chaque deploy. 1 fail bloquant = STOP deploy. Aucune exception.

---

## 1. CHECK_TSC_COMPILATION

Commandes :
```bash
cd ~/purama/mukti && npx tsc --noEmit 2>&1 | tee /tmp/mukti-tsc.log
```
Critère pass : 0 erreurs (exit code 0, log vide ou "Found 0 errors").
Si fail : Lire chaque erreur → corriger types → relancer. JAMAIS commit avec erreurs TS.

## 2. CHECK_BUILD_NEXT

Commandes :
```bash
cd ~/purama/mukti && npm run build 2>&1 | tee /tmp/mukti-build.log
```
Critère pass : 0 erreurs, 0 warnings critiques (warnings ESLint mineurs tolérés mais loggés).
Si fail : Diagnose stack trace → fix imports/SSR/dynamic → re-build. Bug build = bug prod.

## 3. CHECK_NO_TODO_FIXME

Commandes :
```bash
grep -rn "TODO\|FIXME\|XXX\|HACK" ~/purama/mukti/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```
Critère pass : 0 résultat.
Si fail : Implémenter ou retirer. JAMAIS de "à faire plus tard" en prod.

## 4. CHECK_NO_CONSOLE_LOG

Commandes :
```bash
grep -rn "console\.log\|console\.warn\|console\.debug" ~/purama/mukti/src/ --include="*.ts" --include="*.tsx" | grep -v "// @intentional" | grep -v "node_modules"
```
Critère pass : 0 résultat (sauf marqués `// @intentional` pour logs prod monitoring).
Si fail : Supprimer ou marquer @intentional avec justification.

## 5. CHECK_NO_ANY_TYPE

Commandes :
```bash
grep -rn ": any\b\|<any>\|as any\b" ~/purama/mukti/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```
Critère pass : 0 résultat.
Si fail : Typer correctement. `any` = perte de TS. Utiliser `unknown` + type guard.

## 6. CHECK_NO_LOREM_FAKE_CONTENT

Commandes :
```bash
grep -rn "Lorem\|ipsum\|10\.000\|5\.000\|99%\|témoignage de\|placeholder" ~/purama/mukti/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```
Critère pass : 0 résultat (compteurs dynamiques DB, afficher 0 si 0).
Si fail : Remplacer par compteurs Supabase live. JAMAIS faux contenu.

## 7. CHECK_AUTH_FLOWS

Commandes :
```bash
# Test signup email
curl -s -X POST https://auth.purama.dev/auth/v1/signup -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"email":"qa-test+'$(date +%s)'@purama.dev","password":"QaTest2026!"}' | jq .
# Test Google OAuth provider activé
curl -s https://auth.purama.dev/auth/v1/settings | jq '.external.google'
```
Critère pass : signup retourne user object + access_token. Google `enabled:true`.
Si fail : Activer email signup + OAuth Google sur VPS GoTrue, restart container.

## 8. CHECK_SIGNOUT_FLOW

Commandes :
```bash
grep -rn "signOut" ~/purama/mukti/src/ --include="*.ts" --include="*.tsx"
```
Critère pass : Toute occurrence de signOut() est suivie de `clear` storage + `window.location.href='/login'`.
Si fail : Pattern complet : `await supabase.auth.signOut(); localStorage.clear(); sessionStorage.clear(); window.location.href='/login';`

## 9. CHECK_MIDDLEWARE_PRIVATE_ROUTES

Commandes :
```bash
cat ~/purama/mukti/src/middleware.ts | grep -E "(dashboard|admin|circles|wallet)" 
curl -s -o /dev/null -w "%{http_code}" https://mukti.purama.dev/dashboard
```
Critère pass : middleware redirige non-auth vers /login?next= sur routes privées. curl /dashboard sans cookie = 302 → /login.
Si fail : Compléter matcher middleware + redirect logic.

## 10. CHECK_PLAYWRIGHT_TESTS

Commandes :
```bash
cd ~/purama/mukti && npx playwright test --reporter=line 2>&1 | tail -30
```
Critère pass : 100% pass.
Si fail : Lire failed tests → corriger code (pas le test) → re-run.

## 11. CHECK_21_SIM_HUMAN_TESTS

Commandes :
```bash
cd ~/purama/mukti && npx playwright test tests/sim/ --reporter=line
```
Critère pass : 21 simulations humaines passent (inscription, login, navigation, cercle, AR, AURORA, paiement, wallet, parrainage, déconnexion, etc.).
Si fail : Identifier flow cassé → fix → re-test.

## 12. CHECK_RESPONSIVE_375_768_1440

Commandes :
```bash
cd ~/purama/mukti && npx playwright test tests/responsive/ --project=mobile --project=tablet --project=desktop
```
Critère pass : 0 overflow horizontal sur 375 (iPhone SE), 768 (iPad), 1440 (desktop). Boutons ≥ 44px tap target sur mobile.
Si fail : Inspecter screenshots Playwright → corriger Tailwind responsive classes.

## 13. CHECK_ACCESSIBILITY

Commandes :
```bash
npx @axe-core/cli https://mukti.purama.dev --tags wcag2aaa --exit
```
Critère pass : 0 violations critiques. VoiceOver/TalkBack annonce chaque bouton (aria-label). Contraste WCAG AAA. Focus visible 3px outline. Tab navigation logique. Esc ferme modals.
Si fail : Ajouter aria-label, augmenter contraste, fix focus ring.

## 14. CHECK_LIGHTHOUSE

Commandes :
```bash
cd ~/purama/mukti && npx lhci autorun --collect.url=https://mukti.purama.dev --assert.preset=lighthouse:recommended
```
Critère pass : Desktop ≥ 90 perf/a11y/best-practices/SEO. Mobile ≥ 90 sur tous.
Si fail : Optimiser images (next/image), lazy load, code split, fix CLS.

## 15. CHECK_PERFORMANCE_LCP_BUNDLE

Commandes :
```bash
cd ~/purama/mukti && npx next-bundle-analyzer
curl -w "@/tmp/curl-format.txt" -o /dev/null -s https://mukti.purama.dev | grep time_starttransfer
```
Critère pass : LCP ≤ 2.5s. Page bundle ≤ 200KB gzip.
Si fail : Dynamic import composants > 50KB, optimiser fonts, défer scripts non-critiques.

## 16. CHECK_I18N

Commandes :
```bash
ls ~/purama/mukti/messages/ | wc -l
grep -rn "useTranslations\|getTranslations" ~/purama/mukti/src/ | wc -l
```
Critère pass : 30+ fichiers messages/{lang}.json. Switch FR↔EN persiste (cookie locale). RTL fonctionne pour AR/HE (dir="rtl" sur <html>).
Si fail : Compléter traductions manquantes (script content-agent), ajouter logic RTL.

## 17. CHECK_DARK_MODE

Commandes :
```bash
grep -rn "useTheme\|data-theme\|dark:" ~/purama/mukti/src/ --include="*.tsx" | wc -l
```
Critère pass : Dark mode visible (CSS vars + localStorage), contraste suffisant (testé via axe), toutes pages.
Si fail : Audit page par page, ajouter classes `dark:`, vérifier ThemeProvider mount.

## 18. CHECK_SEO

Commandes :
```bash
curl -s https://mukti.purama.dev/sitemap.xml | head -5
curl -s https://mukti.purama.dev/robots.txt
curl -s https://mukti.purama.dev | grep -E "(og:title|og:image|application/ld\+json)"
```
Critère pass : sitemap.xml valide, robots.txt présent, OG meta tags + JSON-LD sur toutes pages publiques.
Si fail : Configurer next-sitemap, ajouter metadata API Next.js 16.

## 19. CHECK_API_SECURITY

Commandes :
```bash
# Auth check
for route in $(find ~/purama/mukti/src/app/api -name "route.ts"); do
  grep -L "auth\.getUser\|verifyJWT\|service_role" "$route"
done
# Zod check
grep -rn "z\.object\|safeParse" ~/purama/mukti/src/app/api/ | wc -l
# Rate limit check
grep -rn "Ratelimit\|@upstash/ratelimit" ~/purama/mukti/src/app/api/ | wc -l
```
Critère pass : Toute route API a auth JWT serveur + Zod schema input + rate limit Upstash + try/catch + erreurs FR explicites + Sentry log si 500.
Si fail : Compléter pattern `withAuth(withRateLimit(withZod(handler)))`.

## 20. CHECK_SUPABASE_SCHEMA_MUKTI

Commandes :
```bash
sshpass -p '+Awy3cwg;NoutOTH' ssh root@72.62.191.111 "docker exec supabase-db psql -U postgres -c \"SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='mukti' ORDER BY tablename;\""
sshpass -p '+Awy3cwg;NoutOTH' ssh root@72.62.191.111 "docker exec supabase-rest env | grep PGRST_DB_SCHEMAS"
```
Critère pass : Schema `mukti` exposé dans PGRST_DB_SCHEMAS. RLS ENABLED sur TOUTES tables. Triggers actifs (vérif `\d+ table_name`).
Si fail : Modifier `docker-compose.yml` PGRST_DB_SCHEMAS=public,mukti, restart supabase-rest. ENABLE RLS manquantes.

## 21. CHECK_CONSOLE_BROWSER

Commandes :
```bash
cd ~/purama/mukti && npx playwright test tests/console.spec.ts
```
Critère pass : 0 erreurs runtime browser. 0 warnings React (key, deprecated lifecycle, hydration mismatch).
Si fail : Fix erreurs hydration (server vs client mismatch), ajouter keys, retirer deprecated.

## 22. CHECK_PWA_LEGAL_SOS_BACKUP_HANDOFF

Commandes :
```bash
# PWA
curl -s https://mukti.purama.dev/manifest.json | jq .
curl -s -o /dev/null -w "%{http_code}" https://mukti.purama.dev/sw.js
# Legal pages
for p in mentions-legales confidentialite cgv cgu cookies; do
  echo "$p: $(curl -s -o /dev/null -w '%{http_code}' https://mukti.purama.dev/$p)"
done
# Disclaimer
grep -rn "Expérience spirituelle personnelle" ~/purama/mukti/src/ | wc -l
# SOS button
grep -rn "SOSButton\|/sos" ~/purama/mukti/src/components/layout/ | wc -l
# Super admin
sshpass -p '+Awy3cwg;NoutOTH' ssh root@72.62.191.111 "docker exec supabase-db psql -U postgres -c \"SELECT email, role FROM mukti.profiles WHERE email='matiss.frasne@gmail.com';\""
# Backup git
cd ~/purama/mukti && git log -1 --oneline && git tag --sort=-creatordate | head -3
# Handoff files
for f in task_plan.md progress.md ERRORS.md PATTERNS.md LEARNINGS.md; do
  test -f ~/purama/mukti/$f && echo "$f: OK" || echo "$f: MISSING"
done
```
Critère pass :
- PWA : manifest.json valide + sw.js 200 + offline mode pour méditations AURORA
- Legal : /mentions-legales /confidentialite /cgv /cgu /cookies toutes 200
- Disclaimer : "Expérience spirituelle personnelle, ne remplace aucun accompagnement médical ou psychologique" affiché onboarding + footer
- SOS : SOSButton visible toutes pages app, modal s'ouvre, ressources urgence FR par défaut (112/3114/3018/3919/119)
- Super admin : matiss.frasne@gmail.com role=super_admin présent
- Backup : git push effectué + tag git pour rollback / Vercel previous deploy accessible
- Rollback ready : commit hash inscrit dans /api/status / `vercel rollback --token $VERCEL_TOKEN` plan documenté
- Handoff : task_plan.md ✅ / progress.md état exact / ERRORS+PATTERNS+LEARNINGS updated

Si fail : Compléter chaque élément manquant. JAMAIS deploy sans backup + rollback plan.

---

## DECISION FINALE

22 checks PASS = `echo "✅ QA OK — deploy autorisé" && exit 0`
1+ check FAIL = `echo "❌ QA FAIL — STOP deploy" && exit 1`

JAMAIS deploy si 1 check fail. Corriger AVANT.
