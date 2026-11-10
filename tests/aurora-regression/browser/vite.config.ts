import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      // The browser gate covers the real ritual UI, clock and audio. The
      // unrelated breathing WebGL canvas is replaced in this local harness.
      { find: './AuroraCanvas', replacement: here('./CanvasPlaceholder.tsx') },
      { find: '@', replacement: here('../../../src') },
      ...['react', 'react-dom', 'sonner', 'lucide-react'].map((name) => ({
        find: new RegExp(`^${name}(/.*)?$`),
        replacement: `${here(`../node_modules/${name}`)}$1`,
      })),
    ],
  },
  server: { host: '127.0.0.1', port: 4178, strictPort: true, fs: { allow: [here('../../..')] } },
})
