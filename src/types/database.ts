export type UserRole = 'reseller' | 'admin'
export type UserStatus = 'active' | 'inactive' | 'blocked'
export type KeyStatus = 'pending' | 'active' | 'expired' | 'blocked'
export type TransactionType =
  | 'recharge'
  | 'credit_added'
  | 'credit_removed'
  | 'key_generated'
  | 'admin_adjustment'
  | 'refund'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'
export type GatewayProvider = 'mercado_pago' | 'efi' | 'manual' | 'other'
export type GatewayStatus = 'active' | 'inactive' | 'testing'
export type FileStatus = 'active' | 'inactive' | 'archived'
export type SkinStatus = 'active' | 'inactive'
export type GlobalControlType = 'pause_all' | 'maintenance_mode' | 'global_message'

export interface Profile {
  id: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
  avatar_url: string | null
  credits: number
  unlimited_credits: boolean
  block_reason: string | null
  blocked_by: string | null
  blocked_at: string | null
  last_login: string | null
  last_recharge: string | null
  total_recharged: number
  total_credits_used: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  credit_cost: number
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KeyDuration {
  id: string
  label: string
  days: number
  credit_multiplier: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Key {
  id: string
  key_value: string
  product_id: string
  created_by: string
  duration_days: number
  duration_label: string
  status: KeyStatus
  credits_cost: number
  block_reason: string | null
  blocked_by: string | null
  blocked_at: string | null
  reset_count: number
  last_reset_at: string | null
  hwid: string | null
  activated_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
  // joins
  product?: Product
  created_by_profile?: Pick<Profile, 'id' | 'username' | 'avatar_url'>
}

export interface CreditTransaction {
  id: string
  user_id: string
  performed_by: string | null
  type: TransactionType
  amount: number
  balance_before: number
  balance_after: number
  key_id: string | null
  description: string | null
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  // joins
  performed_by_profile?: Pick<Profile, 'id' | 'username'>
}

export interface Gateway {
  id: string
  name: string
  provider: GatewayProvider
  status: GatewayStatus
  environment: 'sandbox' | 'production'
  webhook_url: string | null
  last_tested_at: string | null
  last_test_success: boolean | null
  created_by: string
  created_at: string
  updated_at: string
  // NOTE: config (secrets) never returned to client
}

export interface WalletTransaction {
  id: string
  user_id: string
  gateway_id: string | null
  type: string
  amount_brl: number | null
  credits_granted: number | null
  status: TransactionStatus
  payment_id: string | null
  payment_method: string | null
  payment_url: string | null
  pix_qr_code: string | null
  pix_qr_code_base64: string | null
  expires_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // joins
  user?: Pick<Profile, 'id' | 'username' | 'email'>
  gateway?: Pick<Gateway, 'id' | 'name' | 'provider'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  action_url: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface FeatureFlag {
  id: string
  name: string
  label: string
  ff_normal: boolean
  ff_max: boolean
  has_file: boolean
  sort_order: number
  disable_reason: string | null
  disabled_by: string | null
  disabled_at: string | null
  created_at: string
  updated_at: string
}

export interface FileRecord {
  id: string
  feature_id: string
  game: string
  filename: string
  storage_path: string
  file_size: number | null
  sha256: string | null
  version: string | null
  status: FileStatus
  is_current: boolean
  uploaded_by: string
  created_at: string
  // joins
  feature?: FeatureFlag
  uploaded_by_profile?: Pick<Profile, 'id' | 'username'>
}

export interface ModSkin {
  id: string
  name: string
  filename: string
  preview_url: string | null
  preview_storage_path: string | null
  file_storage_path: string | null
  file_sha256: string | null
  status: SkinStatus
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface GlobalControl {
  id: string
  type: GlobalControlType
  is_active: boolean
  value: string | null
  reason: string | null
  activated_by: string | null
  activated_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_username: string | null
  actor_role: UserRole | null
  target_id: string | null
  target_username: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  success: boolean
  error_message: string | null
  created_at: string
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Dashboard stats types
export interface ResellerStats {
  keys_active: number
  keys_pending: number
  keys_expired: number
  keys_blocked: number
  credits: number
  unlimited_credits: boolean
}

export interface AdminStats {
  keys_active: number
  keys_pending: number
  keys_expired: number
  keys_blocked: number
  resellers_active: number
  resellers_inactive: number
  resellers_blocked: number
  total_revenue: number
  credits_in_circulation: number
  credits_used: number
  pending_recharges: number
}
