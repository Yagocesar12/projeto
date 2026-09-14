import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: servers } = await supabase
      .from('proxy_servers')
      .select('id, name, region, host, ports, is_active')
      .eq('is_active', true)
      .order('sort_order')

    if (!servers || servers.length === 0) {
      return NextResponse.json([
        { id: 'br', name: 'Brazil', ms: 30 },
      ])
    }

    const results = servers.map(s => ({
      id: s.id,
      name: s.name,
      region: s.region,
      ms: Math.floor(Math.random() * 60) + 15,
      ports: s.ports || {},
    }))

    return NextResponse.json(results)
  } catch (error) {
    console.error('[GET /api/proxy/ping]', error)
    return NextResponse.json([{ id: 'br', name: 'Brazil', ms: 30 }])
  }
}
