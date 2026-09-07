import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role, id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return { ...profile, userId: user.id }
}

export async function GET(request: NextRequest) {
  // Público — IPA também consulta via Edge Function /config
  const service = await createServiceClient()
  const { data } = await service.from('remote_config').select('*').single()
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const {
      version_current, version_minimum, version_recommended,
      update_url, force_update, maintenance_mode, maintenance_message,
    } = body

    const service = await createServiceClient()
    const { error } = await service
      .from('remote_config')
      .update({
        version_current, version_minimum, version_recommended,
        update_url, force_update, maintenance_mode, maintenance_message,
        updated_by: admin.userId,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined
    await AuditService.log({
      actorId: admin.userId,
      action: 'REMOTE_CONFIG_UPDATED',
      newValues: { version_current, force_update, maintenance_mode },
      ip,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/admin/remote-config]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
