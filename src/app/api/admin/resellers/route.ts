import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, id, username').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = 20

    const service = await createServiceClient()
    let query = service
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'reseller')
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,id.eq.${search.length === 36 ? search : '00000000-0000-0000-0000-000000000000'}`)
    }

    if (status === 'blocked') {
      query = query.eq('status', 'blocked')
    } else if (status === 'active') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      query = query.eq('status', 'active').gte('last_recharge', sevenDaysAgo.toISOString())
    } else if (status === 'inactive') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      query = query.eq('status', 'active').or(`last_recharge.is.null,last_recharge.lt.${sevenDaysAgo.toISOString()}`)
    }

    const { data, count, error } = await query
    if (error) throw error

    // Aggregate stats
    const { data: allProfiles } = await service
      .from('profiles')
      .select('status, last_recharge')
      .eq('role', 'reseller')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const stats = {
      total: allProfiles?.length || 0,
      blocked: allProfiles?.filter(p => p.status === 'blocked').length || 0,
      active: allProfiles?.filter(p =>
        p.status === 'active' && p.last_recharge && new Date(p.last_recharge) >= sevenDaysAgo
      ).length || 0,
      inactive: allProfiles?.filter(p =>
        p.status === 'active' && (!p.last_recharge || new Date(p.last_recharge) < sevenDaysAgo)
      ).length || 0,
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
      stats,
    })
  } catch (error) {
    console.error('[GET /api/admin/resellers]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
