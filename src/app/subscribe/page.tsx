import { redirect } from 'next/navigation'

// Alias conversion : /subscribe?plan=main_annual → /pricing?plan=...
interface PageProps { searchParams: Promise<{ plan?: string }> }

export default async function SubscribePage({ searchParams }: PageProps) {
  const params = await searchParams
  const plan = params.plan ?? 'main_annual'
  redirect(`/pricing?plan=${plan}`)
}
