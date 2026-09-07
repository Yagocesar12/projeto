import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalletClient } from '@/components/dashboard/wallet-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Carteira' }

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, unlimited_credits, total_recharged, total_credits_used')
    .eq('id', user.id)
    .single()

  return (
    <WalletClient
      userId={user.id}
      credits={profile?.credits || 0}
      unlimitedCredits={profile?.unlimited_credits || false}
      totalRecharged={profile?.total_recharged || 0}
      totalUsed={profile?.total_credits_used || 0}
    />
  )
}
