import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, unlimited_credits, role, username, email, avatar_url, status')
      .eq('id', user.id)
      .single()

    const service = await createServiceClient()
    const { data: configs } = await service
      .from('system_config')
      .select('key, value')
      .in('key', ['allowed_durations', 'reseller_allowed_durations', 'key_prefix', 'default_device_limit', 'max_device_limit'])

    const configMap: Record<string, any> = {}
    configs?.forEach(c => { configMap[c.key] = c.value })

    const allDurations = (configMap.allowed_durations as any[]) || []
    const resellerAllowed: number[] = configMap.reseller_allowed_durations || []

    const durations = profile?.role === 'admin'
      ? allDurations
      : allDurations.filter((d: any) => d.permanent || resellerAllowed.includes(d.value))

    const prefix = String(configMap.key_prefix || 'GHOST').replace(/^\"|\"$/g, '')

    return NextResponse.json({
      profile,
      config: {
        durations,
        key_prefix: prefix,
        default_device_limit: Number(configMap.default_device_limit || 1),
        max_device_limit: Number(configMap.max_device_limit || 10),
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
