import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const

const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/aide',
  '/contact',
  '/login',
  '/signup',
  '/forgot-password',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgu',
  '/cgv',
  '/cookies',
] as const

test.describe('Responsive — 4 viewports × public routes', () => {
  for (const vp of VIEWPORTS) {
    for (const route of PUBLIC_ROUTES) {
      test(`${vp.name} ${route}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        const resp = await page.goto(route, { waitUntil: 'domcontentloaded' })
        expect(resp?.status(), `${route} status`).toBeLessThan(400)

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - window.innerWidth
        })
        expect(overflow, `horizontal overflow on ${route} @${vp.width}px`).toBeLessThanOrEqual(2)

        const html = await page.content()
        if (route === '/') {
          expect(html.includes('PURAMA')).toBeTruthy()
        }
      })
    }
  }
})
