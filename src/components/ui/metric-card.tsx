import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  delay?: number
  suffix?: string
  prefix?: string
  trend?: string
}

export function MetricCard({ title, value, icon: Icon, delay = 0, suffix, prefix, trend }: MetricCardProps) {
  return (
    <div className={cn('card-ghost p-4', `animate-stagger-${delay + 1}`)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
        <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
      </div>
      <p className="text-2xl font-semibold text-text-primary tracking-tight">
        {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}{suffix}
      </p>
      {trend && <p className="text-xs text-text-muted mt-1">{trend}</p>}
    </div>
  )
}
