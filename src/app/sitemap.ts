import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://mukti.purama.dev'
  const lastMod = new Date()
  return [
    { url: base, lastModified: lastMod, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${base}/pricing`, lastModified: lastMod, priority: 0.9, changeFrequency: 'weekly' },
    { url: `${base}/login`, lastModified: lastMod, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${base}/signup`, lastModified: lastMod, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${base}/aide`, lastModified: lastMod, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${base}/contact`, lastModified: lastMod, priority: 0.5, changeFrequency: 'monthly' },
    { url: `${base}/mentions-legales`, lastModified: lastMod, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/politique-confidentialite`, lastModified: lastMod, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/cgu`, lastModified: lastMod, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/cgv`, lastModified: lastMod, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/cookies`, lastModified: lastMod, priority: 0.3, changeFrequency: 'yearly' },
  ]
}
