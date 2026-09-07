/**
 * KeyService — Decoupled service layer
 * When the external project is integrated, connect it here.
 * The panel logic does not change — only this service adapts.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { generateKeyValue } from '@/lib/utils'
import type { Key, KeyStatus, PaginatedResponse } from '@/types/database'
import { AuditService } from './audit.service'

export class KeyService {
  /**
   * Generate a new key atomically.
   * All validation happens server-side — frontend sends only identifiers.
   */
  static async generateKey(params: {
    userId: string
    productId: string
    durationId: string
    requestIp?: string
  }): Promise<{ success: boolean; key?: Key; error?: string }> {
    const supabase = await createServiceClient()

    // Fetch duration config from DB — never trust client-sent cost
    const { data: duration, error: durationError } = await supabase
      .from('key_durations')
      .select('*')
      .eq('id', params.durationId)
      .eq('is_active', true)
      .single()

    if (durationError || !duration) {
      return { success: false, error: 'Duração inválida ou inativa' }
    }

    // Fetch product and real cost from DB
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.productId)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return { success: false, error: 'Produto inválido ou inativo' }
    }

    const creditsCost = Math.ceil(product.credit_cost * duration.credit_multiplier)
    const keyValue = generateKeyValue()

    // Execute atomic RPC — handles balance check, deduction, key creation
    const { data, error } = await supabase.rpc('generate_key_atomic', {
      p_user_id: params.userId,
      p_product_id: params.productId,
      p_duration_days: duration.days,
      p_duration_label: duration.label,
      p_credits_cost: creditsCost,
      p_key_value: keyValue,
    })

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Falha ao gerar key' }
    }

    // Fetch the created key to return
    const { data: key } = await supabase
      .from('keys')
      .select('*, product:products(id,name), created_by_profile:profiles!keys_created_by_fkey(id,username,avatar_url)')
      .eq('id', data.key_id)
      .single()

    // Audit log
    await AuditService.log({
      actorId: params.userId,
      action: 'key_created',
      resourceType: 'key',
      resourceId: data.key_id,
      newValues: { key_value: keyValue, product: product.name, duration: duration.label },
      ip: params.requestIp,
    })

    return { success: true, key: key as Key }
  }

  static async getKeys(params: {
    userId: string
    isAdmin: boolean
    status?: KeyStatus
    search?: string
    page?: number
    perPage?: number
  }): Promise<PaginatedResponse<Key>> {
    const supabase = await createServiceClient()
    const page = params.page || 1
    const perPage = params.perPage || 20
    const offset = (page - 1) * perPage

    let query = supabase
      .from('keys')
      .select(
        '*, product:products(id,name), created_by_profile:profiles!keys_created_by_fkey(id,username,avatar_url)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    // RLS handles isolation — admin sees all, reseller sees own
    if (!params.isAdmin) {
      query = query.eq('created_by', params.userId)
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    if (params.search) {
      query = query.or(`key_value.ilike.%${params.search}%`)
    }

    const { data, count, error } = await query

    if (error) throw error

    return {
      data: (data as Key[]) || [],
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    }
  }

  static async blockKey(params: {
    keyId: string
    actorId: string
    isAdmin: boolean
    reason: string
    requestIp?: string
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServiceClient()

    let query = supabase.from('keys').select('id, created_by, status').eq('id', params.keyId)

    if (!params.isAdmin) {
      query = query.eq('created_by', params.actorId)
    }

    const { data: key, error: fetchError } = await query.single()
    if (fetchError || !key) return { success: false, error: 'Key não encontrada' }
    if (key.status === 'blocked') return { success: false, error: 'Key já está bloqueada' }

    const { error } = await supabase
      .from('keys')
      .update({
        status: 'blocked',
        block_reason: params.reason,
        blocked_by: params.actorId,
        blocked_at: new Date().toISOString(),
      })
      .eq('id', params.keyId)

    if (error) return { success: false, error: error.message }

    await AuditService.log({
      actorId: params.actorId,
      action: 'key_blocked',
      resourceType: 'key',
      resourceId: params.keyId,
      reason: params.reason,
      ip: params.requestIp,
    })

    return { success: true }
  }

  static async unblockKey(params: {
    keyId: string
    actorId: string
    isAdmin: boolean
    requestIp?: string
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServiceClient()

    const { error } = await supabase
      .from('keys')
      .update({
        status: 'active',
        block_reason: null,
        blocked_by: null,
        blocked_at: null,
      })
      .eq('id', params.keyId)

    if (error) return { success: false, error: error.message }

    await AuditService.log({
      actorId: params.actorId,
      action: 'key_unblocked',
      resourceType: 'key',
      resourceId: params.keyId,
      ip: params.requestIp,
    })

    return { success: true }
  }

  static async resetKey(params: {
    keyId: string
    actorId: string
    isAdmin: boolean
    requestIp?: string
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServiceClient()

    const { error } = await supabase
      .from('keys')
      .update({
        hwid: null,
        activated_at: null,
        status: 'active',
        last_reset_at: new Date().toISOString(),
        reset_count: supabase.rpc('increment', { x: 1 }) as unknown as number,
      })
      .eq('id', params.keyId)

    if (error) return { success: false, error: error.message }

    await AuditService.log({
      actorId: params.actorId,
      action: 'key_reset',
      resourceType: 'key',
      resourceId: params.keyId,
      ip: params.requestIp,
    })

    return { success: true }
  }

  /**
   * External integration point — FUTURE USE
   * When the external project is provided, implement validation here.
   * This method is called when the external app validates a key.
   */
  static async validateKeyForExternalApp(keyValue: string): Promise<{
    valid: boolean
    status: KeyStatus | null
    message: string
    data?: {
      expires_at: string
      product: string
      hwid: string | null
    }
  }> {
    const supabase = await createServiceClient()

    const { data: key } = await supabase
      .from('keys')
      .select('*, product:products(name)')
      .eq('key_value', keyValue)
      .single()

    if (!key) return { valid: false, status: null, message: 'Key não encontrada' }

    const now = new Date()
    const expiresAt = new Date(key.expires_at)

    if (key.status === 'blocked') {
      return {
        valid: false,
        status: 'blocked',
        message: key.block_reason || 'Key bloqueada',
      }
    }

    if (expiresAt < now) {
      await supabase.from('keys').update({ status: 'expired' }).eq('id', key.id)
      return { valid: false, status: 'expired', message: 'Key expirada' }
    }

    return {
      valid: true,
      status: key.status,
      message: 'OK',
      data: {
        expires_at: key.expires_at,
        product: (key.product as { name: string })?.name || '',
        hwid: key.hwid,
      },
    }
  }
}
