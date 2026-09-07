import { createClient } from '@/lib/supabase/server'
import { TrendingUp, DollarSign, CreditCard, Users } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Análise Financeira' }

async function getAnalysisData() {
  const supabase = await createClient()

  const [walletsRes, profilesRes, licensesRes] = await Promise.all([
    supabase.from('wallet_transactions').select('amount, type, created_at'),
    supabase.from('profiles').select('credits, total_recharged, role').eq('role', 'reseller'),
    supabase.from('licenses').select('credit_cost, created_at, license_status'),
  ])

  const wallets = walletsRes.data || []
  const profiles = profilesRes.data || []
  const licenses = licensesRes.data || []

  const totalCreditsCirculating = profiles.reduce((acc, p) => acc + (p.credits || 0), 0)
  const totalRecharged = profiles.reduce((acc, p) => acc + (p.total_recharged || 0), 0)
  const totalKeysGenerated = licenses.length
  const totalCreditsSpent = licenses.reduce((acc, l) => acc + (l.credit_cost || 0), 0)

  return { totalCreditsCirculating, totalRecharged, totalKeysGenerated, totalCreditsSpent }
}

export default async function AnalysisPage() {
  const data = await getAnalysisData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Análise Financeira</h1>
        <p className="text-sm text-text-muted mt-0.5">Visão geral financeira da plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Créditos em circulação" value={data.totalCreditsCirculating}
          icon={CreditCard} iconColor="text-accent-blue" iconBg="bg-accent-blue/10" delay={0} />
        <MetricCard title="Total recarregado" value={data.totalRecharged}
          icon={DollarSign} iconColor="text-status-success" iconBg="bg-status-success-bg" delay={1} />
        <MetricCard title="Keys geradas" value={data.totalKeysGenerated}
          icon={TrendingUp} iconColor="text-accent-purple" iconBg="bg-accent-purple/10" delay={2} />
        <MetricCard title="Créditos gastos" value={data.totalCreditsSpent}
          icon={Users} iconColor="text-status-warning" iconBg="bg-status-warning-bg" delay={3} />
      </div>

      <div className="card-viibe p-5">
        <p className="text-sm text-text-muted">
          Análise detalhada com gráficos disponível em breve.
        </p>
      </div>
    </div>
  )
}
