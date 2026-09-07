import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-10 h-10 rounded-lg bg-background-tertiary border border-border flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text-primary mb-1">{title}</p>
      {description && <p className="text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
