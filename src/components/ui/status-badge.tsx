import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE:           { label: 'Ativa', className: 'badge-active' },
  active:           { label: 'Ativo', className: 'badge-active' },
  BLOCKED:          { label: 'Bloqueada', className: 'badge-blocked' },
  blocked:          { label: 'Bloqueado', className: 'badge-blocked' },
  PAUSED:           { label: 'Pausada', className: 'badge-pending' },
  NEVER_ACTIVATED:  { label: 'Pendente', className: 'badge-pending' },
  EXPIRED:          { label: 'Expirada', className: 'badge-muted' },
  inactive:         { label: 'Inativo', className: 'badge-muted' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || { label: status, className: 'badge-muted' }
  return (
    <span className={cn(config.className, className)}>
      {config.label}
    </span>
  )
}
