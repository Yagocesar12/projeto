import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreditService } from '@/lib/services/credit.service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const type = searchParams.get('type') || undefined

    const result = await CreditService.getTransactionHistory({ userId: user.id, page, perPage, type })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/credits]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
