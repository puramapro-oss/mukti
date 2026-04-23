'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      toast.error('Impossible d\'envoyer l\'email. Verifie l\'adresse saisie.')
      return
    }
    setSent(true)
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold">
            MUKTI
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Reinitialisation du mot de passe
          </p>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cyan)]/10">
              <Mail className="h-8 w-8 text-[var(--cyan)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Verifie ta boite mail !
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Un lien de reinitialisation a ete envoye a{' '}
                <span className="text-[var(--cyan)]">{email}</span>.
                <br />
                Verifie aussi tes spams.
              </p>
            </div>
            <Link href="/login">
              <Button variant="secondary" size="md">
                Retour a la connexion
              </Button>
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <p className="mb-6 text-sm text-[var(--text-secondary)]">
              Saisis ton adresse email et on t&apos;envoie un lien pour reinitialiser ton mot de passe.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                label="Adresse email"
                type="email"
                placeholder="toi@exemple.fr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="forgot-email-input"
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={!email}
                data-testid="forgot-submit"
              >
                Envoyer le lien
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
              <Link href="/login" className="text-[var(--cyan)] hover:underline">
                ← Retour a la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
