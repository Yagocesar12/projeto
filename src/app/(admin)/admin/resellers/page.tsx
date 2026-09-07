'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MoreHorizontal, Loader2, X, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatRelativeTime, getInitials, cn } from '@/lib/utils'
import { Users } from 'lucide-react'

interface Reseller {
  id: string; username: string; email: string; status: string
  credits: number; unlimited_credits: boolean; total_recharged: number
  total_credits_used: number; last_recharge: string | null; created_at: string
  avatar_url: string | null; last_login: string | null
}

interface MenuState { id: string; username: string; status: string; x: number; y: number }
interface CreditModal { id: string; username: string; credits: number; unlimited: boolean }
interface ConfirmModal { title: string; description: string; action: () => void; danger?: boolean }

export default function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [creditModal, setCreditModal] = useState<CreditModal | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [creditAction, setCreditAction] = useState<'add' | 'remove' | 'unlimited'>('add')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchResellers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/resellers?${params}`)
      const data = await res.json()
      setResellers(data.resellers || data.data || [])
      setTotal(data.total || 0)
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchResellers() }, [fetchResellers])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openMenu = (e: React.MouseEvent, r: Reseller) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ id: r.id, username: r.username, status: r.status, x: rect.right, y: rect.bottom + 4 })
  }

  const handleCredit = async () => {
    if (!creditModal || actionLoading) return
    if (creditAction !== 'unlimited' && !creditAmount) { toast.error('Informe a quantidade'); return }
    setActionLoading(true)
    try {
      const body: any = { action: creditAction }
      if (creditAction !== 'unlimited') body.amount = Number(creditAmount)
      if (creditReason) body.reason = creditReason
      const res = await fetch(`/api/admin/resellers/${creditModal.id}/credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }
      toast.success('Créditos atualizados')
      setCreditModal(null); setCreditAmount(''); setCreditReason('')
      fetchResellers()
    } catch { toast.error('Erro de conexão') }
    finally { setActionLoading(false) }
  }

  const handleStatus = async (id: string, action: 'block' | 'unblock' | 'delete') => {
    try {
      const res = await fetch(`/api/admin/resellers/${id}/${action === 'delete' ? '' : 'status'}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action !== 'delete' ? JSON.stringify({ action }) : undefined,
      })
      if (!res.ok) { toast.error('Erro'); return }
      toast.success(action === 'block' ? 'Conta bloqueada' : action === 'unblock' ? 'Conta desbloqueada' : 'Conta excluída')
      setConfirmModal(null)
      fetchResellers()
    } catch { toast.error('Erro de conexão') }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Revendedores</h2>
        <p className="text-xs text-text-muted mt-0.5">{total.toLocaleString('pt-BR')} revendedor(es)</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por nome, usuário ou e-mail"
          className="input-ghost pl-9" />
      </div>

      {/* Table */}
      <div className="card-ghost overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ghost">
            <thead>
              <tr>
                <th>Revendedor</th>
                <th>Status</th>
                <th>Última recarga</th>
                <th>Créditos</th>
                <th>E-mail</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <TableSkeleton rows={8} cols={6} /> :
               resellers.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Users} title="Nenhum revendedor" /></td></tr>
              ) : resellers.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={r.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-border shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-background-tertiary border border-border flex items-center justify-center shrink-0">
                          <span className="text-2xs font-semibold text-text-muted">{getInitials(r.username)}</span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-text-primary">@{r.username}</span>
                    </div>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-xs text-text-muted">{r.last_recharge ? formatRelativeTime(r.last_recharge) : '—'}</td>
                  <td>
                    <span className="text-xs font-mono font-medium text-text-primary">
                      {r.unlimited_credits ? '∞' : r.credits.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="text-xs text-text-muted">{r.email}</td>
                  <td>
                    <button onClick={e => openMenu(e, r)}
                      className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
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

      {/* Context menu */}
      {menu && (
        <div ref={menuRef}
          className="fixed z-50 bg-white border border-border rounded-lg py-1 min-w-[176px] shadow-dropdown animate-scale-in"
          style={{ left: menu.x, top: menu.y, transformOrigin: 'top right' }}>
          <button className="dropdown-item" onClick={() => { setCreditModal({ id: menu.id, username: menu.username, credits: 0, unlimited: false }); setMenu(null) }}>
            Gerenciar créditos
          </button>
          <button className="dropdown-item" onClick={() => { window.location.href = `/admin/keys?reseller=${menu.id}`; setMenu(null) }}>
            Ver keys
          </button>
          <button className="dropdown-item" onClick={() => { toast.info('Histórico em breve'); setMenu(null) }}>
            Ver histórico
          </button>
          <div className="border-t border-border my-1" />
          {menu.status === 'blocked' ? (
            <button className="dropdown-item danger" onClick={() => {
              setConfirmModal({ title: 'Desbloquear conta', description: `Desbloquear @${menu.username}?`, action: () => handleStatus(menu.id, 'unblock'), danger: true })
              setMenu(null)
            }}>Desbloquear conta</button>
          ) : (
            <button className="dropdown-item danger" onClick={() => {
              setConfirmModal({ title: 'Bloquear conta', description: `Bloquear @${menu.username}? O revendedor não conseguirá mais acessar o painel.`, action: () => handleStatus(menu.id, 'block'), danger: true })
              setMenu(null)
            }}>Bloquear conta</button>
          )}
          <button className="dropdown-item danger" onClick={() => {
            setConfirmModal({ title: 'Excluir conta', description: `Excluir @${menu.username} permanentemente? Esta ação não pode ser desfeita.`, action: () => handleStatus(menu.id, 'delete'), danger: true })
            setMenu(null)
          }}>Excluir conta</button>
        </div>
      )}

      {/* Credit modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Gerenciar créditos — @{creditModal.username}</h3>
              <button onClick={() => setCreditModal(null)} className="p-1 rounded-md text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Action tabs */}
              <div className="flex gap-1 p-1 bg-background-tertiary rounded-md">
                {(['add', 'remove', 'unlimited'] as const).map(a => (
                  <button key={a} onClick={() => setCreditAction(a)}
                    className={cn('flex-1 py-1.5 text-xs font-medium rounded transition-all',
                      creditAction === a ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
                    {a === 'add' ? 'Adicionar' : a === 'remove' ? 'Remover' : 'Ilimitado'}
                  </button>
                ))}
              </div>

              {creditAction !== 'unlimited' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Quantidade</label>
                  <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="0" className="input-ghost" autoFocus />
                </div>
              )}

              {creditAction === 'unlimited' && (
                <div className="p-3 rounded-md bg-background-tertiary border border-border">
                  <p className="text-xs text-text-secondary">Ativar/desativar créditos ilimitados para este revendedor.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Motivo (opcional)</label>
                <input type="text" value={creditReason} onChange={e => setCreditReason(e.target.value)} placeholder="Ex: Recarga manual" className="input-ghost" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setCreditModal(null)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleCredit} disabled={actionLoading} className="btn-black flex-1">
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-status-error-bg border border-status-error-border flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-status-error" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{confirmModal.title}</h3>
                  <p className="text-xs text-text-muted mt-1">{confirmModal.description}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={confirmModal.action} className="btn-danger flex-1">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
