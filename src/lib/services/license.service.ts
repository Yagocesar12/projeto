/**
 * LicenseService — Fonte de verdade: tabela `licenses`
 * Substitui key.service.ts completamente.
 * O painel consome o mesmo sistema que a IPA.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { AuditService } from './audit.service'

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/license-api`

// Alfabeto sem caracteres ambíguos (sem O, 0, I, 1, l)
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateKeyBody(length = 20): string {
  const segments: string[] = []
  const chars = Array.from({ length }, () =>
    KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]
  )
  // Split em 4 grupos de 5: XXXXX-XXXXX-XXXXX-XXXXX
  for (let i = 0; i < 4; i++) {
    segments.push(chars.slice(i * 5, i * 5 + 5).join(''))
  }
  return segments.join('-')
}

async function generateUniqueKey(prefix: string): Promise<{ fullKey: string; hash: string; last4: string }> {
  const supabase = await createServiceClient()

  for (let attempt = 0; attempt < 10; attempt++) {
    const body = generateKeyBody()
    const fullKey = `${prefix}-${body}`
    const hash = await sha256(fullKey.toUpperCase())
    const last4 = body.replace(/-/g, '').slice(-4)

    const { data: existing } = await supabase
      .from('licenses')
      .select('id')
      .eq('key_hash', hash)
      .maybeSingle()

    if (!existing) return { fullKey, hash, last4 }
  }

  throw new Error('KEY_GENERATION_FAILED: too many collisions')
}

export class LicenseService {
  /**
   * Gera uma ou mais licenças atomicamente.
   * Nunca confia em duração ou custo do frontend.
   */
  static async generateLicense(params: {
    ownerId: string
    durationKey: string       // ex: "7-DAYS" ou "1-HOURS" ou "PERMANENT"
    deviceLimit?: number
    quantity?: number
    requestIp?: string
  }): Promise<{ success: boolean; licenses?: Record<string, string>[]; error?: string }> {
    const supabase = await createServiceClient()
    const quantity = Math.min(params.quantity || 1, 50)

    // Buscar configurações do sistema — NUNCA confiar no frontend
    const { data: configRow } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'allowed_durations')
      .single()

    const { data: prefixRow } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'key_prefix')
      .single()

    const allowedDurations: {
      value: number; unit: string; label: string; credit_cost: number; permanent?: boolean
    }[] = configRow?.value || []

    const prefix: string = (prefixRow?.value as string || 'GHOST').replace(/^"|"$/g, '')

    // Verificar se duração é permitida
    const durConfig = allowedDurations.find((d) => {
      if (params.durationKey === 'PERMANENT') return d.permanent === true
      const [val, unit] = params.durationKey.split('-')
      return d.value === parseInt(val) && d.unit === unit
    })

    if (!durConfig) {
      return { success: false, error: 'DURATION_NOT_ALLOWED' }
    }

    // Verificar se reseller pode usar esta duração
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status, credits, unlimited_credits')
      .eq('id', params.ownerId)
      .single()

    if (!profile) return { success: false, error: 'USER_NOT_FOUND' }
    if (profile.status === 'blocked') return { success: false, error: 'ACCOUNT_BLOCKED' }

    if (profile.role === 'reseller') {
      const { data: resellerDurConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'reseller_allowed_durations')
        .single()

      const allowed: number[] = resellerDurConfig?.value || []
      if (!allowed.includes(durConfig.value) && !durConfig.permanent) {
        return { success: false, error: 'DURATION_NOT_ALLOWED_FOR_RESELLER' }
      }
    }

    const totalCost = durConfig.credit_cost * quantity
    if (!profile.unlimited_credits && profile.credits < totalCost) {
      return { success: false, error: 'INSUFFICIENT_CREDITS' }
    }

    // Gerar as keys
    const results: Record<string, string>[] = []
    const errors: string[] = []

    for (let i = 0; i < quantity; i++) {
      try {
        const { fullKey, hash, last4 } = await generateUniqueKey(prefix)

        const { data: rpc } = await supabase.rpc('generate_license_atomic', {
          p_owner_id: params.ownerId,
          p_key_hash: hash,
          p_key_last4: last4,
          p_key_prefix: prefix,
          p_duration_type: durConfig.permanent ? 'PERMANENT' : 'TEMPORARY',
          p_duration_value: durConfig.permanent ? null : durConfig.value,
          p_duration_unit: durConfig.permanent ? null : durConfig.unit,
          p_duration_label: durConfig.label,
          p_credit_cost: durConfig.credit_cost,
          p_device_limit: Math.min(Math.max(params.deviceLimit || 1, 1), 10000),
        })

        if (!rpc?.success) {
          errors.push(rpc?.error || 'RPC_FAILED')
          continue
        }

        await AuditService.log({
          actorId: params.ownerId,
          action: 'KEY_GENERATED',
          resourceType: 'license',
          resourceId: rpc.license_id,
          newValues: { duration: durConfig.label, prefix, last4 },
          ip: params.requestIp,
        })

        results.push({
          license_id: rpc.license_id,
          key: fullKey,    // retornado UMA VEZ ao reseller
          last4,
          duration: durConfig.label,
          balance_after: rpc.balance_after,
        })
      } catch (err: unknown) {
        errors.push(String(err))
      }
    }

    if (results.length === 0) {
      return { success: false, error: errors[0] || 'GENERATION_FAILED' }
    }

    return { success: true, licenses: results }
  }

  /**
   * Listar licenças do usuário (reseller vê só as próprias, admin vê todas)
   */
  static async getLicenses(params: {
    userId: string
    isAdmin: boolean
    status?: string
    activationState?: string
    search?: string
    page?: number
    perPage?: number
  }) {
    const supabase = await createServiceClient()
    const page = params.page || 1
    const perPage = params.perPage || 20
    const offset = (page - 1) * perPage

    let query = supabase
      .from('licenses')
      .select(`
        id, key_last4, key_prefix, duration_type, duration_value,
        duration_unit, duration_label, license_status, activation_state,
        device_binding, activated_at, expires_at, paused_at, paused_duration_ms,
        reset_count, device_limit, block_reason, created_at, updated_at,
        last_heartbeat_at,
        owner:profiles!licenses_owner_id_fkey(id, username, avatar_url),
        current_device:license_devices!licenses_current_device_id_fkey(id, installation_hash_masked, last_seen_at, last_ip)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (!params.isAdmin) {
      query = query.eq('owner_id', params.userId)
    }

    if (params.status) query = query.eq('license_status', params.status)
    if (params.activationState) query = query.eq('activation_state', params.activationState)
    if (params.search) query = query.ilike('key_last4', `%${params.search}%`)

    const { data, count, error } = await query
    if (error) throw error

    return {
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    }
  }

  /**
   * Ação admin/reseller via Edge Function
   */
  static async performAction(params: {
    action: string
    licenseId?: string
    deviceHash?: string
    reason?: string
    callerJwt: string
    requestIp?: string
  }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${EDGE_FUNCTION_URL}/admin/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.callerJwt}`,
      },
      body: JSON.stringify({
        action: params.action,
        license_id: params.licenseId,
        device_hash: params.deviceHash,
        reason: params.reason,
      }),
    })

    const data = await res.json()
    return { success: data.success || false, error: data.error }
  }

  /**
   * Stats para dashboard
   */
  static async getStats(userId: string, isAdmin: boolean) {
    const supabase = await createServiceClient()

    let query = supabase.from('licenses').select('license_status, activation_state')

    if (!isAdmin) query = query.eq('owner_id', userId)

    const { data } = await query

    return {
      active: data?.filter((l) => l.license_status === 'ACTIVE' && l.activation_state === 'ACTIVE').length || 0,
      never_activated: data?.filter((l) => l.activation_state === 'NEVER_ACTIVATED').length || 0,
      expired: data?.filter((l) => l.activation_state === 'EXPIRED').length || 0,
      blocked: data?.filter((l) => l.license_status === 'BLOCKED').length || 0,
      paused: data?.filter((l) => l.license_status === 'PAUSED').length || 0,
    }
  }
}
