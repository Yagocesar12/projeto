import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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

    const service = await createServiceClient()
    // Never return config (secrets) to frontend
    const { data, error } = await service
      .from('gateways')
      .select('id, name, provider, status, environment, webhook_url, last_tested_at, last_test_success, created_at')
      .order('created_at')

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[GET /api/admin/gateways]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { name, provider, environment, config } = body

    if (!name?.trim() || !provider) {
      return NextResponse.json({ error: 'Nome e provedor são obrigatórios' }, { status: 400 })
    }

    const service = await createServiceClient()
    const { data, error } = await service
      .from('gateways')
      .insert({
        name: name.trim(),
        provider,
        environment: environment || 'sandbox',
        config: config || {},  // Stored server-side, never returned to client
        status: 'inactive',
        created_by: admin.userId,
      })
      .select('id, name, provider, status, environment')
      .single()

    if (error) throw error

    await AuditService.log({
      actorId: admin.userId,
      action: 'gateway_created',
      resourceType: 'gateway',
      resourceId: data.id,
      newValues: { name, provider, environment },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[POST /api/admin/gateways]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
