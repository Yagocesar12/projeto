import { createServiceClient } from '@/lib/supabase/server'
import { AuditService } from './audit.service'

export class CreditService {
  static async addCredits(params: {
    adminId: string
    userId: string
    amount: number
    reason?: string
    ip?: string
  }): Promise<{ success: boolean; balanceAfter?: number; error?: string }> {
    if (params.amount <= 0) {
      return { success: false, error: 'Valor deve ser maior que zero' }
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase.rpc('add_credits_atomic', {
      p_admin_id: params.adminId,
      p_user_id: params.userId,
      p_amount: params.amount,
      p_reason: params.reason || null,
    })

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message }
    }

    await AuditService.log({
      actorId: params.adminId,
      targetId: params.userId,
      action: 'credit_added',
      resourceType: 'profile',
      resourceId: params.userId,
      oldValues: { balance: data.balance_before },
      newValues: { balance: data.balance_after, added: params.amount },
      reason: params.reason,
      ip: params.ip,
    })

    return { success: true, balanceAfter: data.balance_after }
  }

  static async removeCredits(params: {
    adminId: string
    userId: string
    amount: number
    reason?: string
    ip?: string
  }): Promise<{ success: boolean; balanceAfter?: number; error?: string }> {
    if (params.amount <= 0) {
      return { success: false, error: 'Valor deve ser maior que zero' }
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase.rpc('remove_credits_atomic', {
      p_admin_id: params.adminId,
      p_user_id: params.userId,
      p_amount: params.amount,
      p_reason: params.reason || null,
    })

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message }
    }

    await AuditService.log({
      actorId: params.adminId,
      targetId: params.userId,
      action: 'credit_removed',
      resourceType: 'profile',
      resourceId: params.userId,
      oldValues: { balance: data.balance_before },
      newValues: { balance: data.balance_after, removed: params.amount },
      reason: params.reason,
      ip: params.ip,
    })

    return { success: true, balanceAfter: data.balance_after }
  }

  static async setUnlimitedCredits(params: {
    adminId: string
    userId: string
    unlimited: boolean
    ip?: string
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServiceClient()

    // Verify caller is admin
    const { data: admin } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', params.adminId)
      .single()

    if (admin?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ unlimited_credits: params.unlimited })
      .eq('id', params.userId)

    if (error) return { success: false, error: error.message }

    await AuditService.log({
      actorId: params.adminId,
      targetId: params.userId,
      action: 'credits_set_unlimited',
      newValues: { unlimited_credits: params.unlimited },
      ip: params.ip,
    })

    return { success: true }
  }

  static async getTransactionHistory(params: {
    userId: string
    page?: number
    perPage?: number
    type?: string
  }) {
    const supabase = await createServiceClient()
    const page = params.page || 1
    const perPage = params.perPage || 20
    const offset = (page - 1) * perPage

    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (params.type) {
      query = query.eq('type', params.type)
    }

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

  static async getWalletSummary(userId: string) {
    const supabase = await createServiceClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, unlimited_credits, total_recharged, total_credits_used')
      .eq('id', userId)
      .single()

    return profile
  }
}
