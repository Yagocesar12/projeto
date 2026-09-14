import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: proxy server polls this to check which features are active for a key
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  const { data: license } = await supabase
    .from('licenses')
    .select('id, status, expires_at, features_enabled')
    .eq('key', key)
    .single()

  if (!license || license.status === 'revoked') {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Key expired' }, { status: 403 })
  }

  // Also get global feature flags
  const { data: flags } = await supabase
    .from('feature_flags')
    .select('name, label, ff_normal, ff_max')
    .order('sort_order')

  return NextResponse.json({
    features: license.features_enabled || {},
    global_flags: flags || [],
  })
}

// POST: user toggles features from the config page
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const key = formData.get('key') as string

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    const { data: license } = await supabase
      .from('licenses')
      .select('id, status, expires_at, features_enabled')
      .eq('key', key)
      .single()

    if (!license || license.status === 'revoked') {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Key expired' }, { status: 403 })
    }

    const currentFeatures = license.features_enabled || {}
    const updates: Record<string, unknown> = {}

    for (const [featureKey, value] of formData.entries()) {
      if (featureKey === 'key') continue
      updates[featureKey] = value === '1' ? true : value === '0' ? false : value
    }

    const merged = { ...currentFeatures, ...updates }

    await supabase
      .from('licenses')
      .update({ features_enabled: merged })
      .eq('id', license.id)

    return NextResponse.json({ success: true, features: merged })
  } catch (error) {
    console.error('[POST /api/proxy/features]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
