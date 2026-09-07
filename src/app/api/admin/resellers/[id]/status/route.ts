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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { action, reason } = body
    const service = await createServiceClient()
    const ip = request.headers.get('x-forwarded-for') || undefined

    if (action === 'block') {
      if (!reason?.trim()) {
        return NextResponse.json({ error: 'Motivo obrigatório' }, { status: 400 })
      }

      const { error } = await service
        .from('profiles')
        .update({
          status: 'blocked',
          block_reason: reason.trim(),
          blocked_by: admin.userId,
          blocked_at: new Date().toISOString(),
        })
        .eq('id', params.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Revoke all active sessions
      await service.auth.admin.signOut(params.id, 'global')

      await AuditService.log({
        actorId: admin.userId,
        targetId: params.id,
        action: 'account_blocked',
        reason: reason.trim(),
        ip,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'unblock') {
      const { error } = await service
        .from('profiles')
        .update({
          status: 'active',
          block_reason: null,
          blocked_by: null,
          blocked_at: null,
        })
        .eq('id', params.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await AuditService.log({
        actorId: admin.userId,
        targetId: params.id,
        action: 'account_unblocked',
        ip,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('[PATCH /api/admin/resellers/:id/status]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
