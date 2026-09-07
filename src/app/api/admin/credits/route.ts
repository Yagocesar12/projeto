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

// GET /api/admin/credits — wallet overview + transactions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const type = searchParams.get('type') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const search = searchParams.get('search') || ''

    const service = await createServiceClient()

    // Summary stats
    const { data: profiles } = await service
      .from('profiles')
      .select('credits, unlimited_credits, total_recharged, total_credits_used')
      .eq('role', 'reseller')

    const totalCreditsInCirculation = profiles?.reduce((sum, p) => sum + (p.unlimited_credits ? 0 : p.credits), 0) || 0
    const totalRecharged = profiles?.reduce((sum, p) => sum + p.total_recharged, 0) || 0
    const totalUsed = profiles?.reduce((sum, p) => sum + p.total_credits_used, 0) || 0
    const resellersWithBalance = profiles?.filter(p => !p.unlimited_credits && p.credits > 0).length || 0

    // Wallet transactions
    let txQuery = service
      .from('wallet_transactions')
      .select('*, user:profiles!wallet_transactions_user_id_fkey(id,username,email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (type) txQuery = txQuery.eq('type', type)
    if (startDate) txQuery = txQuery.gte('created_at', startDate)
    if (endDate) txQuery = txQuery.lte('created_at', endDate)
    if (search) txQuery = txQuery.ilike('user.username', `%${search}%`)

    const { data: transactions, count } = await txQuery

    // Pending recharges
    const { count: pendingCount } = await service
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    return NextResponse.json({
      summary: {
        total_recharged: totalRecharged,
        credits_in_circulation: totalCreditsInCirculation,
        credits_used: totalUsed,
        resellers_with_balance: resellersWithBalance,
        pending_recharges: pendingCount || 0,
      },
      transactions: {
        data: transactions || [],
        total: count || 0,
        page,
        per_page: perPage,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/credits]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
