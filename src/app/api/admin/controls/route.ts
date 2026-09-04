import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { data } = await supabase.from('global_controls').select('*').eq('id', true).single()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[GET /api/admin/controls]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { control, value, reason, message } = body
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined

    const VALID = ['pause_all', 'block_all', 'maintenance']
    if (!VALID.includes(control)) {
      return NextResponse.json({ error: 'Controle inválido' }, { status: 400 })
    }
    if (value && !reason?.trim()) {
      return NextResponse.json({ error: 'Motivo obrigatório' }, { status: 400 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })

    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/license-api/admin/action`
    const actionMap: Record<string, Record<string, string>> = {
      pause_all: { on: 'GLOBAL_PAUSE', off: 'GLOBAL_UNPAUSE' },
      block_all: { on: 'GLOBAL_BLOCK', off: 'GLOBAL_UNBLOCK' },
    }

    if (control === 'maintenance') {
      await supabase.from('global_controls').update({
        maintenance: value,
        maintenance_message: message || null,
        maintenance_reason: reason || null,
        maintenance_at: value ? new Date().toISOString() : null,
        maintenance_by: value ? admin.userId : null,
        updated_at: new Date().toISOString(),
      }).eq('id', true)
    } else {
      const action = value ? actionMap[control].on : actionMap[control].off
      const edgeRes = await fetch(edgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, reason }),
      })
      const data = await edgeRes.json()
      if (!data.success) return NextResponse.json({ error: data.error }, { status: 400 })
    }

    await AuditService.log({
      actorId: admin.userId,
      action: `GLOBAL_${control.toUpperCase()}_${value ? 'ON' : 'OFF'}`,
      newValues: { control, value, reason },
      ip,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/admin/controls]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
