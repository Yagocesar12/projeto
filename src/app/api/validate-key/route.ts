import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, device_id, device_model, ios_version } = body

    if (!key || typeof key !== 'string' || key.length < 8) {
      return NextResponse.json({ success: false, error: 'E_INVALID_KEY', message: 'Key inválida.' }, { status: 400 })
    }
    if (!device_id) {
      return NextResponse.json({ success: false, error: 'E_MISSING_DEVICE', message: 'Device ID obrigatório.' }, { status: 400 })
    }

    const { data: license, error: licErr } = await supabase
      .from('licenses')
      .select('*')
      .eq('key', key)
      .single()

    if (licErr || !license) {
      return NextResponse.json({ success: false, error: 'E_KEY_NOT_FOUND', message: 'Key não encontrada.' }, { status: 404 })
    }

    if (license.status === 'revoked') {
      return NextResponse.json({ success: false, error: 'E_KEY_REVOKED', message: 'Esta KEY está desativada.' }, { status: 403 })
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await supabase.from('licenses').update({ status: 'expired' }).eq('id', license.id)
      return NextResponse.json({ success: false, error: 'E_KEY_EXPIRED', message: 'Esta KEY está expirada.' }, { status: 403 })
    }

    if (license.product && license.product !== 'nubank' && license.product !== 'all') {
      return NextResponse.json({ success: false, error: 'E_WRONG_PRODUCT', message: 'Esta KEY pertence a outro produto.' }, { status: 403 })
    }

    const deviceLimit = license.device_limit || 1
    const devices: string[] = license.activated_devices || []

    if (!devices.includes(device_id)) {
      if (devices.length >= deviceLimit) {
        return NextResponse.json({ success: false, error: 'E_DEVICE_LIMIT', message: 'Limite de dispositivos atingido.' }, { status: 403 })
      }
      devices.push(device_id)
      await supabase.from('licenses').update({
        activated_devices: devices,
        activation_state: 'activated',
        activated_at: license.activated_at || new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        last_device_model: device_model || null,
        last_ios_version: ios_version || null,
      }).eq('id', license.id)
    } else {
      await supabase.from('licenses').update({
        last_seen_at: new Date().toISOString(),
        last_device_model: device_model || null,
        last_ios_version: ios_version || null,
      }).eq('id', license.id)
    }

    const sessionToken = crypto.randomBytes(32).toString('hex')
    const sessionExpiresAt = new Date()
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 24)

    await supabase.from('license_sessions').upsert({
      license_id: license.id,
      device_id,
      session_token: sessionToken,
      expires_at: sessionExpiresAt.toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'license_id,device_id' })

    supabase.from('license_audit_logs').insert({
      license_id: license.id,
      action: 'validate',
      device_id,
      device_model: device_model || null,
      ios_version: ios_version || null,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {})

    return NextResponse.json({
      success: true,
      session_token: sessionToken,
      expires_at: sessionExpiresAt.toISOString(),
      license: {
        id: license.id,
        expires_at: license.expires_at,
        duration: license.duration,
        product: license.product,
        device_limit: deviceLimit,
        features_enabled: license.features_enabled || null,
      }
    })
  } catch (error) {
    console.error('[POST /api/validate-key]', error)
    return NextResponse.json({ success: false, error: 'E_SERVER', message: 'Erro interno.' }, { status: 500 })
  }
}
