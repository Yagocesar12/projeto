import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KeyService } from '@/lib/services/key.service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify account not blocked
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status === 'blocked') {
      return NextResponse.json({ success: false, error: 'Conta bloqueada' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, durationId } = body

    if (!productId || !durationId) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') || undefined

    const result = await KeyService.generateKey({
      userId: user.id,
      productId,
      durationId,
      requestIp: ip,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, key: result.key })
  } catch (error) {
    console.error('[POST /api/keys]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')

    const result = await KeyService.getKeys({
      userId: user.id,
      isAdmin: profile.role === 'admin',
      status,
      search,
      page,
      perPage,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/keys]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
