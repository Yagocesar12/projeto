import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KeyService } from '@/lib/services/key.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status === 'blocked') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, reason } = body
    const ip = request.headers.get('x-forwarded-for') || undefined

    let result: { success: boolean; error?: string }

    switch (action) {
      case 'block':
        if (!reason?.trim()) {
          return NextResponse.json({ error: 'Motivo obrigatório' }, { status: 400 })
        }
        result = await KeyService.blockKey({
          keyId: params.id,
          actorId: user.id,
          isAdmin: profile.role === 'admin',
          reason: reason.trim(),
          requestIp: ip,
        })
        break

      case 'unblock':
        result = await KeyService.unblockKey({
          keyId: params.id,
          actorId: user.id,
          isAdmin: profile.role === 'admin',
          requestIp: ip,
        })
        break

      case 'reset':
        result = await KeyService.resetKey({
          keyId: params.id,
          actorId: user.id,
          isAdmin: profile.role === 'admin',
          requestIp: ip,
        })
        break

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/keys/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
