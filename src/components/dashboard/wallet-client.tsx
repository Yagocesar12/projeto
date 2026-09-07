'use client'

import { useState, useEffect } from 'react'
import { Wallet, TrendingDown, TrendingUp, ArrowDownLeft, Infinity } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, cn } from '@/lib/utils'
import type { CreditTransaction } from '@/types/database'

const TRANSACTION_LABELS: Record<string, string> = {
  recharge: 'Recarga',
  credit_added: 'Crédito adicionado',
  credit_removed: 'Crédito removido',
  key_generated: 'Key gerada',
  admin_adjustment: 'Ajuste administrativo',
  refund: 'Reembolso',
}

interface WalletClientProps {
  userId: string
  credits: number
  unlimitedCredits: boolean
  totalRecharged: number
  totalUsed: number
}

export function WalletClient({ userId, credits, unlimitedCredits, totalRecharged, totalUsed }: WalletClientProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), per_page: '20', ...(typeFilter && { type: typeFilter }) })
        const res = await fetch(`/api/credits?${params}`)
        const data = await res.json()
        setTransactions(data.data || [])
        setTotal(data.total || 0)
      } catch {} finally { setLoading(false) }
    }
    fetch()
  }, [page, typeFilter])

  const TYPE_FILTERS = [
    { label: 'Todos', value: '' },
    { label: 'Recargas', value: 'recharge' },
    { label: 'Keys', value: 'key_generated' },
    { label: 'Ajustes', value: 'admin_adjustment' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Carteira</h1>
        <p className="text-sm text-text-muted mt-0.5">Seus créditos e movimentações</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-viibe p-5 col-span-2 lg:col-span-1 animate-stagger-1">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Saldo atual</p>
          <div className="flex items-end gap-2">
            {unlimitedCredits ? (
              <div className="flex items-center gap-2">
                <Infinity className="w-8 h-8 text-accent-blue" />
                <span className="text-2xl font-bold text-accent-blue">Ilimitado</span>
              </div>
            ) : (
              <span className="text-3xl font-bold font-mono text-text-primary">
                {credits.toLocaleString('pt-BR')}
              </span>
            )}
          </div>
          {!unlimitedCredits && <p className="text-xs text-text-muted mt-1">créditos disponíveis</p>}
        </div>

        <MetricCard title="Total recarregado" value={totalRecharged} icon={TrendingUp}
          iconColor="text-status-success" iconBg="bg-status-success-bg" delay={1} />
        <MetricCard title="Total utilizado" value={totalUsed} icon={TrendingDown}
          iconColor="text-status-error" iconBg="bg-status-error-bg" delay={2} />
        <MetricCard title="Total recebido" value={totalRecharged} icon={ArrowDownLeft}
          iconColor="text-accent-blue" iconBg="bg-accent-blue/10" delay={3} />
      </div>

      {/* History */}
      <div className="card-viibe animate-stagger-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Histórico</h2>
          </div>
          <div className="flex gap-1">
            {TYPE_FILTERS.map((f) => (
              <button key={f.value} onClick={() => { setTypeFilter(f.value); setPage(1) }}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
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
                <th>Operação</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Saldo após</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <TableSkeleton rows={5} cols={4} /> :
               transactions.length === 0 ? (
                <tr><td colSpan={4}>
                  <EmptyState icon={Wallet} title="Nenhuma movimentação" description="Suas transações aparecerão aqui." />
                </td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-xs">{formatDate(tx.created_at)}</td>
                  <td>
                    <span className="text-xs text-text-secondary">{TRANSACTION_LABELS[tx.type] || tx.type}</span>
                    {tx.description && <p className="text-xs text-text-muted mt-0.5">{tx.description}</p>}
                  </td>
                  <td className="text-right">
                    <span className={cn('font-mono text-sm font-bold', tx.amount >= 0 ? 'text-status-success' : 'text-status-error')}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm">{tx.balance_after.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">Página {page} de {Math.ceil(total / 20)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Anterior</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="btn-secondary px-3 py-1.5 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
