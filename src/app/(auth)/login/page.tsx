'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const { signIn, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error('Erreur Google : ' + (error.message ?? 'Connexion impossible'))
      setGoogleLoading(false)
    }
    // redirect handled by OAuth callback
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast.error('Identifiants incorrects. Verifie ton email et mot de passe.')
      return
    }
    router.push(next)
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl" aria-hidden>🕉️</span>
            <span className="gradient-text font-[family-name:var(--font-display)] text-3xl font-bold">MUKTI</span>
          </Link>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Bon retour. Le mouvement t&apos;attendait.
          </p>
        </div>

        {/* Google OAuth */}
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={googleLoading}
          data-testid="google-login"
          onClick={handleGoogleLogin}
          icon={
            !googleLoading ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
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

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Input
            id="password"
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password-input"
            required
          />

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                className="accent-[var(--cyan)]"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                data-testid="remember-me"
              />
              Rester connecte
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-[var(--cyan)] hover:underline"
            >
              Mot de passe oublie ?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-2 w-full"
            loading={loading}
            disabled={!email || !password}
            data-testid="login-button"
          >
            Se connecter
          </Button>
        </form>

        {/* Sign up link */}
        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-[var(--cyan)] hover:underline">
            Creer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center text-[var(--text-muted)]">
          Chargement...
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
