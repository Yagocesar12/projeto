import { createServiceClient } from '@/lib/supabase/server'

interface AuditLogParams {
  actorId?: string
  action: string
  targetId?: string
  resourceType?: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  reason?: string
  ip?: string
  userAgent?: string
  success?: boolean
  errorMessage?: string
}

export class AuditService {
  static async log(params: AuditLogParams): Promise<void> {
    try {
      const supabase = await createServiceClient()

      // Fetch actor info if we have an ID
      let actorUsername: string | null = null
      let actorRole: string | null = null

      if (params.actorId) {
        const { data: actor } = await supabase
          .from('profiles')
          .select('username, role')
          .eq('id', params.actorId)
          .single()

        actorUsername = actor?.username || null
        actorRole = actor?.role || null
      }

      // Fetch target info if we have an ID
      let targetUsername: string | null = null

      if (params.targetId) {
        const { data: target } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', params.targetId)
          .single()

        targetUsername = target?.username || null
      }

      await supabase.from('audit_logs').insert({
        actor_id: params.actorId || null,
        actor_username: actorUsername,
        actor_role: actorRole,
        target_id: params.targetId || null,
        target_username: targetUsername,
        action: params.action,
        resource_type: params.resourceType || null,
        resource_id: params.resourceId || null,
        old_values: params.oldValues || null,
        new_values: params.newValues || null,
        reason: params.reason || null,
        ip_address: params.ip || null,
        user_agent: params.userAgent || null,
        success: params.success !== undefined ? params.success : true,
        error_message: params.errorMessage || null,
      })
    } catch (error) {
      // Audit logging failure should not break the main operation
      console.error('[AuditService] Failed to log:', error)
    }
  }

  static async getLogs(params: {
    page?: number
    perPage?: number
    actorId?: string
    targetId?: string
    action?: string
    startDate?: string
    endDate?: string
    search?: string
  }) {
    const supabase = await createServiceClient()
    const page = params.page || 1
    const perPage = params.perPage || 50
    const offset = (page - 1) * perPage

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (params.actorId) query = query.eq('actor_id', params.actorId)
    if (params.targetId) query = query.eq('target_id', params.targetId)
    if (params.action) query = query.eq('action', params.action)
    if (params.startDate) query = query.gte('created_at', params.startDate)
    if (params.endDate) query = query.lte('created_at', params.endDate)
    if (params.search) {
      query = query.or(
        `actor_username.ilike.%${params.search}%,target_username.ilike.%${params.search}%`
      )
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
}
