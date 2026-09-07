import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'
import { CreditService } from '@/lib/services/credit.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id, username')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { ...profile, userId: user.id }
}

// DELETE /api/admin/resellers/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const targetId = params.id
    const service = await createServiceClient()

    // Fetch target for audit
    const { data: target } = await service
      .from('profiles')
      .select('username, email')
      .eq('id', targetId)
      .single()

    if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Invalidate all keys
    await service
      .from('keys')
      .update({ status: 'blocked', block_reason: 'Conta excluída' })
      .eq('created_by', targetId)

    // Delete auth user (cascades to profile via FK)
    const { error } = await service.auth.admin.deleteUser(targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await AuditService.log({
      actorId: admin.userId,
      action: 'account_deleted',
      targetId,
      newValues: { username: target.username, email: target.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/resellers/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
