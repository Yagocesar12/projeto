'use client'

import { useState, useEffect } from 'react'
import { Wallet, TrendingUp, Coins, ArrowDownLeft, Clock, Users } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatCurrency, cn } from '@/lib/utils'

const PERIOD_FILTERS = [
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
]

const TX_TYPE_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Recargas', value: 'recharge' },
  { label: 'Ajustes', value: 'adjustment' },
  { label: 'Pagas', value: 'completed' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Canceladas', value: 'cancelled' },
]

const TX_LABELS: Record<string, string> = {
  recharge: 'Recarga',
  adjustment: 'Ajuste',
  credit_purchase: 'Compra de créditos',
}

export default function AdminWalletPage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/credits')
        const data = await res.json()
        setSummary(data.summary)
        setTransactions(data.transactions?.data || [])
        setTotal(data.transactions?.total || 0)
      } catch {} finally { setLoading(false) }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const fetchTx = async () => {
      setTxLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), per_page: '20', ...(typeFilter && { type: typeFilter }) })
        const res = await fetch(`/api/admin/credits?${params}`)
        const data = await res.json()
        setTransactions(data.transactions?.data || [])
        setTotal(data.transactions?.total || 0)
      } catch {} finally { setTxLoading(false) }
    }
    fetchTx()
  }, [page, typeFilter])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Carteira</h1>
        <p className="text-sm text-text-muted">Centro financeiro da plataforma</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Créditos em Circulação" value={summary?.credits_in_circulation || 0}
          icon={Coins} iconColor="text-accent-blue" iconBg="bg-accent-blue/10" delay={0} />
        <MetricCard title="Total Recarregado" value={summary?.total_recharged || 0}
          icon={TrendingUp} iconColor="text-status-success" iconBg="bg-status-success-bg" delay={1} />
        <MetricCard title="Créditos Utilizados" value={summary?.credits_used || 0}
          icon={ArrowDownLeft} iconColor="text-status-error" iconBg="bg-status-error-bg" delay={2} />
        <MetricCard title="Recargas Pendentes" value={summary?.pending_recharges || 0}
          icon={Clock} iconColor="text-status-warning" iconBg="bg-status-warning-bg" delay={3} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard title="Revendedores com Saldo" value={summary?.resellers_with_balance || 0}
          icon={Users} iconColor="text-accent-blue" iconBg="bg-accent-blue/10" delay={4} />
      </div>

      {/* Transactions */}
      <div className="card-viibe">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Transações</h2>
          </div>
          <div className="flex gap-1 flex-wrap">
            {TX_TYPE_FILTERS.map(f => (
              <button key={f.value} onClick={() => { setTypeFilter(f.value); setPage(1) }}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  typeFilter === f.value ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary hover:bg-background-hover')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-viibe">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Operação</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Créditos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading || txLoading ? <TableSkeleton rows={5} cols={6} /> :
               transactions.length === 0 ? (
                <tr><td colSpan={6}>
                  <EmptyState icon={Wallet} title="Nenhuma transação encontrada" />
                </td></tr>
              ) : transactions.map((tx: any) => (
                <tr key={tx.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(tx.created_at)}</td>
                  <td>
                    {tx.user ? (
                      <div>
                        <p className="text-xs font-medium text-text-primary">@{tx.user.username}</p>
                        <p className="text-xs text-text-muted">{tx.user.email}</p>
                      </div>
                    ) : <span className="text-xs text-text-muted">—</span>}
                  </td>
                  <td className="text-xs">{TX_LABELS[tx.type] || tx.type}</td>
                  <td className="text-right font-mono text-sm">
                    {tx.amount_brl ? formatCurrency(tx.amount_brl) : '—'}
                  </td>
                  <td className="text-right font-mono text-sm text-accent-blue">
                    {tx.credits_granted ? `+${tx.credits_granted.toLocaleString('pt-BR')}` : '—'}
                  </td>
                  <td><StatusBadge status={tx.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-1.5 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
