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

// GET /api/admin/system-config — lê configurações
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createServiceClient()
    const { data } = await service
      .from('system_config')
      .select('key, value, description, updated_at')
      .in('key', ['key_prefix', 'allowed_durations', 'reseller_allowed_durations',
                  'default_device_limit', 'max_device_limit', 'credits_per_brl',
                  'min_recharge_brl', 'max_recharge_brl', 'recharge_bonus_percent'])

    // Transform to object
    const config: Record<string, unknown> = {}
    data?.forEach(row => { config[row.key] = row.value })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('[GET /api/admin/system-config]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/system-config — atualiza configurações
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { key, value } = body

    const ALLOWED_KEYS = [
      'key_prefix', 'allowed_durations', 'reseller_allowed_durations',
      'default_device_limit', 'max_device_limit', 'credits_per_brl',
      'min_recharge_brl', 'max_recharge_brl', 'recharge_bonus_percent',
      'auto_approve_recharge',
    ]

    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Chave de configuração inválida' }, { status: 400 })
    }

    // Validação específica do prefixo
    if (key === 'key_prefix') {
      const prefix = String(value).replace(/^"|"$/g, '').trim()
      if (!prefix || !/^[A-Z0-9_-]{1,20}$/.test(prefix)) {
        return NextResponse.json({ error: 'Prefixo inválido. Use apenas letras maiúsculas, números, _ e - (máx. 20 chars)' }, { status: 400 })
      }
    }

    const service = await createServiceClient()
    await service.from('system_config').upsert({
      key,
      value: typeof value === 'string' ? JSON.parse(JSON.stringify(value)) : value,
      updated_by: admin.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined
    await AuditService.log({
      actorId: admin.userId,
      action: 'SETTINGS_CHANGED',
      newValues: { key, value },
      ip,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/admin/system-config]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
