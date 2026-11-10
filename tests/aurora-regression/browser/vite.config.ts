import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
export default defineConfig({
  root: here('.'),
  resolve: {
    alias: [
      // The unrelated breathing WebGL canvas is outside the ritual/audio gate.
      { find: './AuroraCanvas', replacement: here('./CanvasPlaceholder.tsx') },
      { find: '@', replacement: here('../../../src') },
      { find: 'next/link', replacement: here('./next-link.tsx') },
      { find: 'tailwindcss', replacement: here('../node_modules/tailwindcss/index.css') },
      ...['react', 'react-dom', 'sonner', 'lucide-react', 'zod'].map(name => ({
        find: new RegExp(`^${name}(/.*)?$`), replacement: `${here(`../node_modules/${name}`)}$1`,
      })),
    ],
    dedupe: ['react', 'react-dom'],
  },
  oxc: { jsx: { runtime: 'automatic' } },
  // Keep CSS tooling and source discovery inside this harness. The application
  // stylesheet is real, but its root PostCSS configuration is not loaded here.
  css: { postcss: { plugins: [tailwindcss({ base: here('.') })] } },
  server: {
    host: '127.0.0.1', port: 4173, strictPort: true,
    fs: { allow: [here('../../..')], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**'] },
  },
})
