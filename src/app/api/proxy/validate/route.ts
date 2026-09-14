import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, ip } = body

    if (!key || !ip) {
      return NextResponse.json({ allowed: false, error: 'Missing key or ip' }, { status: 400 })
    }

    const { data: license, error } = await supabase
      .from('licenses')
      .select('id, key, status, expires_at, features_enabled, product')
      .eq('key', key)
      .single()

    if (error || !license) {
      return NextResponse.json({ allowed: false, error: 'Key not found' }, { status: 404 })
    }

    if (license.status === 'revoked' || license.status === 'banned') {
      return NextResponse.json({ allowed: false, error: 'Key revoked' }, { status: 403 })
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await supabase.from('licenses').update({ status: 'expired' }).eq('id', license.id)
      return NextResponse.json({ allowed: false, error: 'Key expired' }, { status: 403 })
    }

    // Register/update IP binding
    await supabase.from('proxy_sessions').upsert({
      license_id: license.id,
      ip_address: ip,
      last_seen_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'license_id,ip_address' })

    return NextResponse.json({
      allowed: true,
      license_id: license.id,
      features: license.features_enabled || {},
      expires_at: license.expires_at,
    })
  } catch (error) {
    console.error('[POST /api/proxy/validate]', error)
    return NextResponse.json({ allowed: false, error: 'Server error' }, { status: 500 })
  }
}
