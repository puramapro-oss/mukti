'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'

function getPasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const STRENGTH_LABELS = ['Trop court', 'Faible', 'Moyen', 'Fort', 'Excellent']
const STRENGTH_COLORS = ['bg-red-500', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']

export default function SignupPage() {
  const router = useRouter()
  const { signUp, signInWithGoogle } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const strength = getPasswordStrength(password)
  const passwordsMatch = password === confirmPassword
  const confirmError = confirmPassword && !passwordsMatch ? 'Les mots de passe ne correspondent pas' : ''

  const canSubmit =
    name.trim().length > 0 &&
    email.length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    cguAccepted

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error('Erreur Google : ' + (error.message ?? 'Connexion impossible'))
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    const { error } = await signUp(email, password, name.trim())
    setLoading(false)
    if (error) {
      toast.error('Erreur lors de la creation du compte : ' + (error.message ?? 'Reessaie plus tard'))
      return
    }
    toast.success('Bienvenue dans MUKTI. Ta libération commence maintenant.')
    router.push('/dashboard')
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl" aria-hidden>🕉️</span>
            <span className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold">MUKTI</span>
          </Link>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Crée ton compte. 14 jours d&apos;essai. Pas de carte requise.
          </p>
        </div>

        {/* Google OAuth */}
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={googleLoading}
          data-testid="google-signup"
          onClick={handleGoogleSignup}
          icon={
            !googleLoading ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            ) : undefined
          }
        >
          Continuer avec Google
        </Button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">ou</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="name"
            label="Prenom"
            type="text"
            placeholder="Alice"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="name-input"
            required
          />
          <Input
            id="email"
            label="Adresse email"
            type="email"
            placeholder="toi@exemple.fr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email-input"
            required
          />
          <div className="flex flex-col gap-1.5">
            <Input
              id="password"
              label="Mot de passe"
              type="password"
              placeholder="8 caracteres minimum"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="password-input"
              required
            />
            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        strength >= i ? STRENGTH_COLORS[strength] : 'bg-white/10'
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {STRENGTH_LABELS[strength]}
                </p>
              </div>
            )}
          </div>
          <Input
            id="confirmPassword"
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-testid="confirm-password-input"
            error={confirmError}
            required
          />

          {/* CGU checkbox */}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="mt-0.5 accent-[var(--cyan)]"
              checked={cguAccepted}
              onChange={(e) => setCguAccepted(e.target.checked)}
              data-testid="cgu-checkbox"
            />
            <span>
              J&apos;accepte les{' '}
              <Link href="/cgu" className="text-[var(--cyan)] hover:underline" target="_blank">
                Conditions Generales
              </Link>{' '}
              et la{' '}
              <Link href="/politique-confidentialite" className="text-[var(--cyan)] hover:underline" target="_blank">
                Politique de confidentialite
              </Link>
            </span>
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-2 w-full"
            loading={loading}
            disabled={!canSubmit}
            data-testid="signup-button"
          >
            Creer mon compte
          </Button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Deja un compte ?{' '}
          <Link href="/login" className="text-[var(--cyan)] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
