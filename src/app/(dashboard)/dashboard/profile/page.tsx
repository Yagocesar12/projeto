import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from '@/components/dashboard/profile-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Meu Perfil' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Key stats
  const { data: keys } = await supabase
    .from('keys')
    .select('status')
    .eq('created_by', user.id)

  const keyStats = {
    total: keys?.length || 0,
    active: keys?.filter(k => k.status === 'active').length || 0,
    pending: keys?.filter(k => k.status === 'pending').length || 0,
    expired: keys?.filter(k => k.status === 'expired').length || 0,
    blocked: keys?.filter(k => k.status === 'blocked').length || 0,
  }

  return <ProfileClient profile={profile as any} keyStats={keyStats} />
}
