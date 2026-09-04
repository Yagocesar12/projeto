import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin/shell'
import type { Profile } from '@/types/database'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Hard server-side role check — never trust frontend
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  if (profile.status === 'blocked') redirect('/blocked')

  return <AdminShell profile={profile as Profile}>{children}</AdminShell>
}
