import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  resolve: {
    alias: [
      { find: '@', replacement: here('../../src') },
      ...['react', 'react-dom', 'sonner', 'lucide-react', '@react-three/fiber'].map((name) => ({
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
  },
})
