import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { SUPER_ADMIN_EMAIL } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatEurosFraction(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon apres-midi'
  return 'Bonsoir'
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  return email === SUPER_ADMIN_EMAIL
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function timeUntil(date: string | Date): string {
  const d = new Date(date).getTime() - Date.now()
  if (d < 0) return 'Terminé'
  const days = Math.floor(d / (1000 * 60 * 60 * 24))
  const hours = Math.floor((d / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((d / (1000 * 60)) % 60)
  if (days > 0) return `dans ${days}j ${hours}h`
  if (hours > 0) return `dans ${hours}h ${minutes}min`
  return `dans ${minutes}min`
}

export function levelFromXp(xp: number): { id: number; name: string; emoji: string; progress: number } {
  if (xp < 100) return { id: 1, name: 'Éveillé', emoji: '👁️', progress: xp / 100 }
  if (xp < 500) return { id: 2, name: 'Chercheur', emoji: '🔍', progress: (xp - 100) / 400 }
  if (xp < 2000) return { id: 3, name: 'Récupérateur', emoji: '💰', progress: (xp - 500) / 1500 }
  if (xp < 10000) return { id: 4, name: 'Stratège', emoji: '🧠', progress: (xp - 2000) / 8000 }
  return { id: 5, name: 'Maître', emoji: '👑', progress: 1 }
}

export function formatPoints(points: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(points)} pts`
}
