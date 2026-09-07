import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function GET() {
  try {
    const user = await verifyAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const service = await createServiceClient()

    const [licensesRes, profilesRes] = await Promise.all([
      service.from('licenses').select('license_status, activation_state'),
      service.from('profiles').select('id, username, avatar_url, total_credits_used').eq('role', 'reseller').order('total_credits_used', { ascending: false }).limit(10),
    ])

    const licenses = licensesRes.data || []
    const profiles = profilesRes.data || []

    const stats = {
      keys_active:  licenses.filter(l => l.license_status === 'ACTIVE' && l.activation_state === 'ACTIVE').length,
      keys_pending: licenses.filter(l => l.activation_state === 'NEVER_ACTIVATED').length,
      keys_expired: licenses.filter(l => l.activation_state === 'EXPIRED').length,
      keys_blocked: licenses.filter(l => l.license_status === 'BLOCKED').length,
    }

    const top_resellers = profiles.map((p, i) => ({
      rank: i + 1,
      username: p.username,
      avatar_url: p.avatar_url,
      credits_used: p.total_credits_used || 0,
    }))

    return NextResponse.json({ stats, top_resellers })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
