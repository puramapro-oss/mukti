import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  resolve: {
    alias: [
      { find: '@', replacement: here('../../src') },
      ...['react', 'react-dom', 'sonner', 'lucide-react', '@react-three/fiber', 'next', 'zod', '@supabase/ssr', '@supabase/supabase-js', '@anthropic-ai/sdk', '@capacitor/core', '@capacitor/app'].map((name) => ({
        find: new RegExp(`^${name}(/.*)?$`),
        replacement: `${here(`node_modules/${name}`)}$1`,
      })),
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['*.test.{ts,tsx}'],
    setupFiles: ['./setup.ts'],
    restoreMocks: true,
    maxWorkers: 1,
    // PGlite compiles PostgreSQL WASM. Bound its compiler parallelism in the
    // actual test worker: Vitest does not forward arbitrary parent V8 flags.
    execArgv: ['--wasm-num-compilation-tasks=1', '--max-old-space-size=512'],
  },
})
