import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role, id').eq('id', user.id).single()
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

    const service = await createServiceClient()
    const { data: gateway } = await service
      .from('gateways')
      .select('provider, config, environment')
      .eq('id', params.id)
      .single()

    if (!gateway) return NextResponse.json({ error: 'Gateway não encontrado' }, { status: 404 })

    // Basic connectivity test per provider
    let success = false
    let error = null

    try {
      switch (gateway.provider) {
        case 'mercado_pago': {
          const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: { 'Authorization': `Bearer ${gateway.config.access_token}` },
          })
          success = res.status === 200
          if (!success) error = `HTTP ${res.status}`
          break
        }
        case 'efi': {
          // Basic credential validation — real OAuth would go here
          success = !!(gateway.config.client_id && gateway.config.client_secret)
          if (!success) error = 'Credenciais incompletas'
          break
        }
        case 'manual':
          success = !!(gateway.config.pix_key)
          if (!success) error = 'Chave PIX não configurada'
          break
        default:
          success = true
      }
    } catch (e: any) {
      success = false
      error = e.message
    }

    // Update test result
    await service
      .from('gateways')
      .update({ last_tested_at: new Date().toISOString(), last_test_success: success })
      .eq('id', params.id)

    return NextResponse.json({ success, error })
  } catch (err) {
    console.error('[POST /api/admin/gateways/:id/test]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
