import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import path from "node:path"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  transpilePackages: ['@purama/smarana'],
  experimental: { externalDir: true },
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: {
    root: path.join(__dirname, '..'),
    resolveAlias: {
      '@purama/smarana': '../packages/smarana/src/index.ts',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.pollinations.ai' },
    ],
  },
}

export default withNextIntl(nextConfig)
