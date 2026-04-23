import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion — MUKTI',
  description:
    'Connecte-toi à MUKTI : scanner financier, démarches automatiques, wallet IBAN, alertes droits. Email ou Google, session 30 jours.',
  alternates: { canonical: 'https://mukti.purama.dev/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
