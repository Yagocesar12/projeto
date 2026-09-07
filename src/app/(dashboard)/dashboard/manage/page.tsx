'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, Copy, Eye, RotateCcw, ShieldOff, ShieldCheck, Loader2, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { formatDate, cn } from '@/lib/utils'
import type { Key, KeyStatus } from '@/types/database'

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Todas', value: '' },
  { label: 'Ativas', value: 'active' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Expiradas', value: 'expired' },
  { label: 'Bloqueadas', value: 'blocked' },
]

interface ActionModal {
  type: 'block' | 'unblock' | 'reset' | 'detail'
  key: Key
}

export default function ManagePage() {
  const [keys, setKeys] = useState<Key[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ActionModal | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      })
      const res = await fetch(`/api/keys?${params}`)
      const data = await res.json()
      setKeys(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar keys')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300)
    return () => clearTimeout(t)
  }, [search])

  const copyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue)
    toast.success('Key copiada!')
  }

  const handleAction = async () => {
    if (!modal || actionLoading) return
    setActionLoading(true)

    try {
      const body: Record<string, string> = { action: modal.type }
      if (modal.type === 'block') {
        if (!blockReason.trim()) { toast.error('Informe o motivo'); return }
        body.reason = blockReason.trim()
      }

      const res = await fetch(`/api/keys/${modal.key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }

      toast.success(
        modal.type === 'block' ? 'Key bloqueada' :
        modal.type === 'unblock' ? 'Key desbloqueada' : 'Key resetada'
      )
      setModal(null)
      setBlockReason('')
      fetchKeys()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Gerenciar Keys</h1>
        <p className="text-sm text-text-muted mt-0.5">{total} key{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar key ou produto..."
            className="input-viibe pl-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1) }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                statusFilter === f.value
                  ? 'bg-accent-blue text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-background-hover border border-border'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-viibe overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-viibe">
            <thead>
              <tr>
                <th>Key</th>
                <th>Produto</th>
                <th>Duração</th>
                <th>Validade</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Search}
                      title="Nenhuma key encontrada"
                      description="Quando você gerar uma key, ela aparecerá aqui."
                    />
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-accent-blue">
                        {key.key_value}
                      </span>
                    </td>
                    <td>
                      <span className="text-text-secondary text-xs">
                        {(key.product as any)?.name || '—'}
                      </span>
                    </td>
                    <td className="text-xs">{key.duration_label}</td>
                    <td className="text-xs">{formatDate(key.expires_at)}</td>
                    <td><StatusBadge status={key.status} /></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => copyKey(key.key_value)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-all"
                          title="Copiar">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setModal({ type: 'detail', key })}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-all"
                          title="Detalhes">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setModal({ type: 'reset', key })}
                          className="p-1.5 rounded-lg text-text-muted hover:text-status-warning hover:bg-status-warning-bg transition-all"
                          title="Resetar">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        {key.status === 'blocked' ? (
                          <button onClick={() => setModal({ type: 'unblock', key })}
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-success hover:bg-status-success-bg transition-all"
                            title="Desbloquear">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => setModal({ type: 'block', key })}
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all"
                            title="Bloquear">
                            <ShieldOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-1.5 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* ACTION MODAL */}
      {modal && modal.type !== 'detail' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">
                {modal.type === 'block' ? 'Bloquear Key' : modal.type === 'unblock' ? 'Desbloquear Key' : 'Resetar Key'}
              </h2>
              <button onClick={() => { setModal(null); setBlockReason('') }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background-secondary border border-border">
                <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-mono font-bold text-text-primary">{modal.key.key_value}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {modal.type === 'block' ? 'A key será bloqueada imediatamente.' :
                     modal.type === 'unblock' ? 'A key voltará ao estado ativo.' :
                     'O HWID e ativação serão removidos.'}
                  </p>
                </div>
              </div>

              {modal.type === 'block' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Motivo *</label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Informe o motivo do bloqueio"
                    className="input-viibe"
                    autoFocus
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setModal(null); setBlockReason('') }} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading || (modal.type === 'block' && !blockReason.trim())}
                  className={cn('flex-1', modal.type === 'block' ? 'btn-danger' : 'btn-primary')}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    modal.type === 'block' ? 'Bloquear' :
                    modal.type === 'unblock' ? 'Desbloquear' : 'Resetar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
