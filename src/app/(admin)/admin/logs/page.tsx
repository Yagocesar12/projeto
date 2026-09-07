'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, cn } from '@/lib/utils'
import { ScrollText } from 'lucide-react'

interface LogEntry {
  id: string; actor_username: string | null; actor_role: string | null
  action: string; target_username: string | null; key_last4: string | null
  metadata: any; success: boolean; error_message: string | null; created_at: string
}

const FILTERS = ['Todos', 'Revendedores', 'Keys', 'Créditos', 'Dispositivos', 'Admin']

const ACTION_LABELS: Record<string, string> = {
  account_created: 'Conta criada',
  account_blocked: 'Conta bloqueada',
  account_unblocked: 'Conta desbloqueada',
  account_deleted: 'Conta excluída',
  credit_added: 'Créditos adicionados',
  credit_removed: 'Créditos removidos',
  key_created: 'Key gerada',
  key_reset: 'Key resetada',
  key_blocked: 'Key bloqueada',
  key_unblocked: 'Key desbloqueada',
  device_banned: 'Device banido',
  device_unbanned: 'Device desbanido',
  admin_action: 'Ação admin',
  settings_changed: 'Config alterada',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || data.data || [])
      setTotal(data.total || 0)
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Atividade</h2>
        <p className="text-xs text-text-muted mt-0.5">Histórico de ações da plataforma</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar ação, usuário..."
            className="input-ghost pl-9 w-56" />
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-2.5 py-1.5 text-xs rounded-md font-medium border transition-all',
                filter === f ? 'bg-accent-black text-white border-accent-black' : 'bg-white text-text-secondary border-border hover:border-border-strong')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card-ghost overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ghost">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <TableSkeleton rows={10} cols={5} /> :
               logs.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={ScrollText} title="Nenhuma atividade registrada" /></td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td className="text-xs text-text-muted font-mono whitespace-nowrap">
                    {formatDate(l.created_at)}
                  </td>
                  <td className="text-xs text-text-primary">
                    {l.actor_username ? `@${l.actor_username}` : '—'}
                    {l.actor_role && <span className="ml-1 text-text-muted">({l.actor_role})</span>}
                  </td>
                  <td className="text-xs text-text-primary font-medium">
                    {ACTION_LABELS[l.action] || l.action}
                  </td>
                  <td className="text-xs text-text-muted">
                    {l.target_username ? `@${l.target_username}` : l.key_last4 ? `****${l.key_last4}` : '—'}
                  </td>
                  <td>
                    {l.success
                      ? <span className="badge-active">OK</span>
                      : <span className="badge-blocked">Erro</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost px-3 py-1.5 text-xs">Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost px-3 py-1.5 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
