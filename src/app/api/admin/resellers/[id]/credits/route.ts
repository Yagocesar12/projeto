import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreditService } from '@/lib/services/credit.service'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { action, amount, reason, unlimited } = body
    const ip = request.headers.get('x-forwarded-for') || undefined

    switch (action) {
      case 'add': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
        }
        const result = await CreditService.addCredits({
          adminId: admin.userId,
          userId: params.id,
          amount: parseInt(amount),
          reason,
          ip,
        })
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
        return NextResponse.json({ success: true, balanceAfter: result.balanceAfter })
      }

      case 'remove': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
        }
        const result = await CreditService.removeCredits({
          adminId: admin.userId,
          userId: params.id,
          amount: parseInt(amount),
          reason,
          ip,
        })
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
        return NextResponse.json({ success: true, balanceAfter: result.balanceAfter })
      }

      case 'unlimited': {
        const result = await CreditService.setUnlimitedCredits({
          adminId: admin.userId,
          userId: params.id,
          unlimited: !!unlimited,
          ip,
        })
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (error) {
    console.error('[POST /api/admin/resellers/:id/credits]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
