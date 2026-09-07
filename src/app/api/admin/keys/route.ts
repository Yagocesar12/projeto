import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KeyService } from '@/lib/services/key.service'

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
    const status = searchParams.get('status') as any
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const resellerId = searchParams.get('reseller') || undefined

    const result = await KeyService.getKeys({
      userId: admin.userId,
      isAdmin: true,
      status,
      search: search || (resellerId ? undefined : undefined),
      page,
      perPage,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/admin/keys]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
