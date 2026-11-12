// Explicit routing adapter for this isolated component harness, not Next.js.
const router = Object.freeze({
  replace(destination: string) {
    window.dispatchEvent(new CustomEvent('mukti-test:navigate', { detail: destination }))
  },
})
export function useRouter() { return router }
