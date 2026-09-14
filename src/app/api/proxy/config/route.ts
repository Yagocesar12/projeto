import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ENCRYPTION_KEY = process.env.PROXY_CONFIG_SECRET || 'default-change-me-32-bytes-key!!'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return iv.toString('base64') + encrypted
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, server_id, port } = body

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    // Validate key
    const { data: license } = await supabase
      .from('licenses')
      .select('id, status, expires_at')
      .eq('key', key)
      .single()

    if (!license || license.status === 'revoked') {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Key expired' }, { status: 403 })
    }

    // Get server config
    let serverHost = process.env.PROXY_DEFAULT_HOST || '0.0.0.0'
    let serverPort = port || 10025

    if (server_id) {
      const { data: server } = await supabase
        .from('proxy_servers')
        .select('host, ports')
        .eq('id', server_id)
        .eq('is_active', true)
        .single()

      if (server) {
        serverHost = server.host
        if (server.ports && typeof server.ports === 'object') {
          const ports = server.ports as Record<string, number>
          serverPort = ports[String(port)] || Object.values(ports)[0] || 10025
        }
      }
    }

    // Build HappProxy config
    const configPayload = JSON.stringify({
      server: serverHost,
      port: serverPort,
      key: key,
      license_id: license.id,
      ts: Date.now(),
    })

    const encryptedConfig = encrypt(configPayload)
    const deepLink = `happ://crypt5/${encryptedConfig}`

    return NextResponse.json({
      deep_link: deepLink,
      server: serverHost,
      port: serverPort,
    })
  } catch (error) {
    console.error('[POST /api/proxy/config]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
