import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Key, Clock, XCircle, ShieldX } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

async function getStats(userId: string) {
  const supabase = await createClient()
  const { data: licenses } = await supabase.from('licenses').select('license_status, activation_state').eq('owner_id', userId)
  return {
    active:  licenses?.filter(l => l.license_status === 'ACTIVE' && l.activation_state === 'ACTIVE').length || 0,
    pending: licenses?.filter(l => l.activation_state === 'NEVER_ACTIVATED').length || 0,
    expired: licenses?.filter(l => l.activation_state === 'EXPIRED').length || 0,
    blocked: licenses?.filter(l => l.license_status === 'BLOCKED').length || 0,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const stats = await getStats(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Visão geral</h2>
        <p className="text-xs text-text-muted mt-0.5">Suas keys e ativações</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Ativas" value={stats.active} icon={Key} delay={0} />
        <MetricCard title="Pendentes" value={stats.pending} icon={Clock} delay={1} />
        <MetricCard title="Expiradas" value={stats.expired} icon={XCircle} delay={2} />
        <MetricCard title="Bloqueadas" value={stats.blocked} icon={ShieldX} delay={3} />
      </div>

      <div className="card-ghost p-5 animate-stagger-5">
        <h3 className="text-sm font-medium text-text-primary mb-1">Começando</h3>
        <p className="text-xs text-text-muted">
          Vá em <span className="text-text-primary font-medium">Keys</span> para gerar e gerenciar suas licenças.
        </p>
      </div>
    </div>
  )
}
