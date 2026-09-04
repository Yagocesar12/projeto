import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GenerateLicenseClient } from '@/components/dashboard/generate-license-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gerar Key' }

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, unlimited_credits, role')
    .eq('id', user.id)
    .single()

  const service = await createServiceClient()
  const { data: configs } = await service
    .from('system_config')
    .select('key, value')
    .in('key', ['allowed_durations', 'reseller_allowed_durations', 'key_prefix', 'default_device_limit', 'max_device_limit'])

  const configMap: Record<string, unknown> = {}
  configs?.forEach(c => { configMap[c.key] = c.value })

  const allDurations = (configMap.allowed_durations as any[]) || []
  const resellerAllowed: number[] = (configMap.reseller_allowed_durations as number[]) || []

  const availableDurations = profile?.role === 'admin'
    ? allDurations
    : allDurations.filter((d: any) => d.permanent || resellerAllowed.includes(d.value))

  const prefix = String(configMap.key_prefix || 'GHOST').replace(/^"|"$/g, '')

  return (
    <GenerateLicenseClient
      credits={profile?.credits || 0}
      unlimitedCredits={profile?.unlimited_credits || false}
      isAdmin={profile?.role === 'admin'}
      durations={availableDurations}
      keyPrefix={prefix}
      defaultDeviceLimit={Number(configMap.default_device_limit || 1)}
      maxDeviceLimit={Number(configMap.max_device_limit || 10)}
    />
  )
}
