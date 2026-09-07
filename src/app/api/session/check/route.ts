import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/session/check — verifica sessão ativa do app iOS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_token, device_id } = body

    if (!session_token || !device_id) {
      return NextResponse.json({ valid: false, error: 'E_MISSING_PARAMS' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: session, error } = await supabase
      .from('license_sessions')
      .select('*, licenses(*)')
      .eq('session_token', session_token)
      .eq('device_id', device_id)
      .single()

    if (error || !session) {
      return NextResponse.json({ valid: false, error: 'E_INVALID_SESSION' })
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'E_SESSION_EXPIRED' })
    }

    const license = session.licenses as any
    if (!license || license.license_status === 'BLOCKED' || license.status === 'revoked') {
      return NextResponse.json({ valid: false, error: 'E_KEY_REVOKED' })
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'E_KEY_EXPIRED' })
    }

    // Renova sessão por mais 24h
    const newExpiry = new Date()
    newExpiry.setHours(newExpiry.getHours() + 24)
    await supabase
      .from('license_sessions')
      .update({ expires_at: newExpiry.toISOString() })
      .eq('session_token', session_token)

    return NextResponse.json({
      valid: true,
      expires_at: license.expires_at,
      features_enabled: license.features_enabled || null,
    })
  } catch (error) {
    console.error('[POST /api/session/check]', error)
    return NextResponse.json({ valid: false, error: 'E_SERVER' }, { status: 500 })
  }
}
