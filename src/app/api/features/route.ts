import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
    const { data: { user } } = await supabase.auth.getUser()

    // Feature flags are readable by authenticated users
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createServiceClient()
    const { data, error } = await service
      .from('feature_flags')
      .select('*')
      .order('sort_order')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[GET /api/features]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { id, field, value, reason } = body

    if (!id || !field || !['ff_normal', 'ff_max'].includes(field)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const service = await createServiceClient()

    const updateData: Record<string, unknown> = { [field]: value }

    // If disabling, record who and when
    if (value === false) {
      updateData.disable_reason = reason || null
      updateData.disabled_by = admin.userId
      updateData.disabled_at = new Date().toISOString()
    } else {
      updateData.disable_reason = null
      updateData.disabled_by = null
      updateData.disabled_at = null
    }

    const { error } = await service
      .from('feature_flags')
      .update(updateData)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await AuditService.log({
      actorId: admin.userId,
      action: 'feature_toggled',
      resourceType: 'feature_flag',
      resourceId: id,
      newValues: { field, value, reason },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/features]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
