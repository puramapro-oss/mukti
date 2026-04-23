import { test, expect } from '@playwright/test'

// Snapshots verbatim from messages/{locale}.json — vidaaide.tagline + vidaaide.loginCta
const LOCALES: Array<{
  code: string
  taglineFragment: string
  loginCta: string
  rtl?: boolean
}> = [
  { code: 'fr', taglineFragment: 'Récupère tout', loginCta: 'Connexion' },
  { code: 'en', taglineFragment: 'Claim back every euro', loginCta: 'Sign in' },
  { code: 'es', taglineFragment: 'Recupera todo el dinero', loginCta: 'Iniciar sesión' },
  { code: 'de', taglineFragment: 'Hol dir jeden Euro', loginCta: 'Anmelden' },
  { code: 'it', taglineFragment: 'Recupera ogni euro', loginCta: 'Accedi' },
  { code: 'pt', taglineFragment: 'Recupera todo o dinheiro', loginCta: 'Entrar' },
  { code: 'nl', taglineFragment: 'Haal elke euro terug', loginCta: 'Inloggen' },
  { code: 'pl', taglineFragment: 'Odzyskaj każde euro', loginCta: 'Zaloguj się' },
  { code: 'sv', taglineFragment: 'Ta tillbaka varje euro', loginCta: 'Logga in' },
  { code: 'tr', taglineFragment: 'Masada bıraktığın', loginCta: 'Giriş yap' },
  { code: 'ru', taglineFragment: 'Верни каждый евро', loginCta: 'Войти' },
  { code: 'ar', taglineFragment: 'استرجع كل يورو', loginCta: 'تسجيل الدخول', rtl: true },
  { code: 'zh', taglineFragment: '把你留在桌上的每一欧元', loginCta: '登录' },
  { code: 'ja', taglineFragment: 'テーブルに置き忘れている', loginCta: 'ログイン' },
  { code: 'ko', taglineFragment: '테이블 위에 두고 있는', loginCta: '로그인' },
  { code: 'hi', taglineFragment: 'मेज़ पर छोड़ा हर यूरो', loginCta: 'साइन इन' },
]

test.describe('P5 — i18n 16 langues bascule réelle', () => {
  test('POST /api/locale invalid → 400', async ({ request }) => {
    const res = await request.post('/api/locale', { data: { locale: 'klingon' } })
    expect(res.status()).toBe(400)
  })

  test('POST /api/locale missing body → 400', async ({ request }) => {
    const res = await request.post('/api/locale', { data: {} })
    expect(res.status()).toBe(400)
  })

  for (const l of LOCALES) {
    test(`POST /api/locale ${l.code} → 200 + sets cookie`, async ({ request }) => {
      const res = await request.post('/api/locale', { data: { locale: l.code } })
      expect(res.status()).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.locale).toBe(l.code)
      const setCookie = res.headers()['set-cookie'] ?? ''
      expect(setCookie).toContain('locale=')
    })
  }

  for (const l of LOCALES) {
    test(`Landing rendered in ${l.code} (cookie locale=${l.code})`, async ({ context, page }) => {
      await context.addCookies([
        {
          name: 'locale',
          value: l.code,
          domain: 'mukti.purama.dev',
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
        },
      ])

      const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBeLessThan(400)

      const html = page.locator('html')
      await expect(html).toHaveAttribute('lang', l.code)
      await expect(html).toHaveAttribute('dir', l.rtl ? 'rtl' : 'ltr')

      const body = await page.content()
      expect(body).toContain(l.taglineFragment)
      expect(body).toContain(l.loginCta)
    })
  }
})
