import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'
import { EmailService } from '@/lib/services/email.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role, id, status').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin' || profile.status === 'blocked') return null
  return { ...profile, userId: user.id }
}

// GET /api/admin/devices — lista todos os devices e bans
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'devices'  // devices | bans
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = 20
    const offset = (page - 1) * perPage

    const service = await createServiceClient()

    if (tab === 'bans') {
      const { data, count } = await service
        .from('device_blocks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1)

      return NextResponse.json({ data: data || [], total: count || 0, page, per_page: perPage })
    }

    // Dispositivos vinculados a licenças
    const { data, count } = await service
      .from('license_devices')
      .select(`
        id, installation_hash_masked, binding_status,
        first_seen_at, last_seen_at, last_ip,
        session_expires_at, revoked_at, revoke_reason,
        license:licenses(id, key_last4, key_prefix, license_status, activation_state,
          owner:profiles!licenses_owner_id_fkey(id, username))
      `, { count: 'exact' })
      .order('last_seen_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    return NextResponse.json({ data: data || [], total: count || 0, page, per_page: perPage })
  } catch (error) {
    console.error('[GET /api/admin/devices]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/devices — ban ou unban de device
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { action, installation_hash, reason } = body
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined

    if (!installation_hash || !['BAN', 'UNBAN'].includes(action)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    if (action === 'BAN' && !reason?.trim()) {
      return NextResponse.json({ error: 'Motivo obrigatório para banir dispositivo' }, { status: 400 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })

    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/license-api/admin/action`
    const edgeAction = action === 'BAN' ? 'BAN_DEVICE' : 'UNBAN_DEVICE'

    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: edgeAction, device_hash: installation_hash, reason }),
    })

    const data = await edgeRes.json()
    if (!data.success) return NextResponse.json({ error: data.error }, { status: 400 })

    await AuditService.log({
      actorId: admin.userId,
      action: action === 'BAN' ? 'DEVICE_BANNED' : 'DEVICE_UNBANNED',
      newValues: { installation_hash_masked: installation_hash.slice(0, 8) + '...', reason },
      ip,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/admin/devices]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
