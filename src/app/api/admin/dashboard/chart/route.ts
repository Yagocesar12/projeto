import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const days = parseInt(new URL(request.url).searchParams.get('days') || '7')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const service = await createServiceClient()
    const { data: licenses } = await service
      .from('licenses')
      .select('created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    // Group by date
    const byDate: Record<string, number> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      byDate[d.toISOString().split('T')[0]] = 0
    }

    for (const l of licenses || []) {
      const date = l.created_at.split('T')[0]
      if (byDate[date] !== undefined) byDate[date]++
    }

    const chart = Object.entries(byDate).map(([date, keys]) => ({ date, keys, credits: 0 }))

    return NextResponse.json({ chart })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
