'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Send, Video, Camera } from 'lucide-react'

export default function AmbassadeurApplyForm() {
  const router = useRouter()
  const [bio, setBio] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [youtube, setYoutube] = useState('')
  const [website, setWebsite] = useState('')
  const [pending, startTransition] = useTransition()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (bio.trim().length < 30) {
      toast.error('Bio trop courte (30 caractères minimum).')
      return
    }
    const socialLinks: Record<string, string> = {}
    if (instagram) socialLinks.instagram = instagram
    if (tiktok) socialLinks.tiktok = tiktok
    if (youtube) socialLinks.youtube = youtube
    if (website) socialLinks.website = website
    startTransition(async () => {
      try {
        const res = await fetch('/api/ambassadeur/apply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bio, social_links: socialLinks }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erreur.')
        if (data.approved) {
          toast.success(`Bienvenue en tier ${data.tier.toUpperCase()} !`)
        } else {
          toast.success('Candidature envoyée. Auto-approuvée dès 10 conversions actives.')
        }
        router.push('/dashboard/ambassadeur')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="ambassadeur-apply-form">
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">Bio ({bio.length}/500)</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, 500))}
          placeholder="Raconte-nous qui tu es, pourquoi tu veux porter MUKTI, et ta communauté…"
          className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 min-h-[140px] focus:outline-none focus:border-violet-500"
          required
          minLength={30}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-white/80 mb-2">Réseaux sociaux (optionnel)</legend>
        {[
          { icon: Camera, label: 'Instagram', placeholder: 'https://instagram.com/...', value: instagram, setter: setInstagram },
          { icon: Video, label: 'TikTok', placeholder: 'https://tiktok.com/@...', value: tiktok, setter: setTiktok },
          { icon: Video, label: 'YouTube', placeholder: 'https://youtube.com/@...', value: youtube, setter: setYoutube },
          { icon: Globe, label: 'Site web', placeholder: 'https://...', value: website, setter: setWebsite },
        ].map(({ icon: Icon, label, placeholder, value, setter }) => (
          <div key={label} className="relative">
            <Icon className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input
              type="url"
              value={value}
              onChange={e => setter(e.target.value)}
              placeholder={placeholder}
              aria-label={label}
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
            />
          </div>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={pending || bio.trim().length < 30}
        data-testid="ambassadeur-apply-submit"
        className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 px-6 py-3 font-semibold flex items-center justify-center gap-2"
      >
        <Send className="h-4 w-4" />
        {pending ? 'Envoi…' : 'Envoyer ma candidature'}
      </button>
    </form>
  )
}
