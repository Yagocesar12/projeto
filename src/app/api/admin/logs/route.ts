import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { ...profile, userId: user.id }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)

    const result = await AuditService.getLogs({
      page: parseInt(searchParams.get('page') || '1'),
      perPage: parseInt(searchParams.get('per_page') || '50'),
      actorId: searchParams.get('actor_id') || undefined,
      targetId: searchParams.get('target_id') || undefined,
      action: searchParams.get('action') || undefined,
      startDate: searchParams.get('start_date') || undefined,
      endDate: searchParams.get('end_date') || undefined,
      search: searchParams.get('search') || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/admin/logs]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
