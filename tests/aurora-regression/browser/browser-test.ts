import { test as base, expect } from '@playwright/test'

// Every scenario uses a fresh local page. Per-test API mocks are registered
// later and take precedence over this deny-by-default network boundary.
export const test = base.extend<{ localPageGuard: void }>({
  localPageGuard: [async ({ page }, use) => {
    const blocked: string[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== 'http://127.0.0.1:4173' || url.pathname.startsWith('/api/')) {
        blocked.push(`${route.request().method()} ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      await route.continue()
    })
    await use()
    expect(blocked, 'No external service or unconfigured API may be contacted').toEqual([])
    expect(errors, 'The real browser must not report an uncaught page error').toEqual([])
  }, { auto: true }],
})

export { expect }
