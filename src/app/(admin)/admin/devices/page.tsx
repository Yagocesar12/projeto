'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Smartphone, ShieldX, ShieldCheck, Search,
  X, Loader2, AlertTriangle, Clock, Wifi
} from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'

interface DeviceRecord {
  id: string
  installation_hash_masked: string
  binding_status: string
  first_seen_at: string
  last_seen_at: string | null
  last_ip: string | null
  session_expires_at: string | null
  license: {
    id: string
    key_last4: string
    key_prefix: string
    license_status: string
    activation_state: string
    owner: { id: string; username: string } | null
  } | null
}

interface BanRecord {
  id: string
  installation_hash_masked: string
  reason: string | null
  banned_at: string
  unbanned_at: string | null
  is_active: boolean
  last_seen_ip: string | null
  attempt_count: number
}

interface BanModal {
  hash: string
  masked: string
  action: 'BAN' | 'UNBAN'
}

export default function AdminDevicesPage() {
  const [tab, setTab] = useState<'devices' | 'bans'>('devices')
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [bans, setBans] = useState<BanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<BanModal | null>(null)
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab, page: String(page) })
      const res = await fetch(`/api/admin/devices?${params}`)
      const data = await res.json()

      if (tab === 'bans') {
        setBans(data.data || [])
      } else {
        setDevices(data.data || [])
      }
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAction = async () => {
    if (!modal || actionLoading) return
    if (modal.action === 'BAN' && !reason.trim()) {
      toast.error('Motivo obrigatório para banir')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modal.action,
          installation_hash: modal.hash,
          reason: reason.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }

      toast.success(modal.action === 'BAN' ? 'Dispositivo banido' : 'Dispositivo desbanido')
      setModal(null)
      setReason('')
      fetchData()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  const BINDING_COLORS: Record<string, string> = {
    BOUND:   'text-status-success',
    NONE:    'text-text-muted',
    REVOKED: 'text-status-warning',
  }

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE:  'text-status-success',
    BLOCKED: 'text-status-error',
    PAUSED:  'text-status-warning',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <Smartphone className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dispositivos</h1>
          <p className="text-sm text-text-muted">{total.toLocaleString('pt-BR')} registro(s)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['devices', 'bans'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={cn('px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t
                ? 'text-accent-blue border-accent-blue'
                : 'text-text-muted border-transparent hover:text-text-secondary')}>
            {t === 'devices' ? 'Dispositivos ativos' : 'Dispositivos banidos'}
          </button>
        ))}
      </div>

      {/* Devices tab */}
      {tab === 'devices' && (
        <div className="card-viibe overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-viibe">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Key</th>
                  <th>Reseller</th>
                  <th>Status</th>
                  <th>Primeiro acesso</th>
                  <th>Último acesso</th>
                  <th>IP</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton rows={8} cols={8} /> :
                 devices.length === 0 ? (
                  <tr><td colSpan={8}>
                    <EmptyState icon={Smartphone} title="Nenhum dispositivo registrado" />
                  </td></tr>
                ) : devices.map(d => (
                  <tr key={d.id}>
                    <td>
                      <code className="text-xs font-mono text-text-secondary">
                        {d.installation_hash_masked || '—'}
                      </code>
                    </td>
                    <td>
                      {d.license ? (
                        <span className="text-xs font-mono font-bold text-accent-blue">
                          {d.license.key_prefix}-****{d.license.key_last4}
                        </span>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td>
                      <span className="text-xs text-text-secondary">
                        {d.license?.owner?.username ? `@${d.license.owner.username}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={cn('text-xs font-medium', BINDING_COLORS[d.binding_status] || 'text-text-muted')}>
                        ● {d.binding_status}
                      </span>
                    </td>
                    <td className="text-xs">{formatDate(d.first_seen_at)}</td>
                    <td className="text-xs">{formatRelativeTime(d.last_seen_at)}</td>
                    <td className="text-xs font-mono text-text-muted">{d.last_ip || '—'}</td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setModal({
                            hash: d.installation_hash_masked,
                            masked: d.installation_hash_masked,
                            action: 'BAN',
                          })}
                          className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all"
                          title="Banir dispositivo">
                          <ShieldX className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary px-3 py-1.5 text-xs">Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bans tab */}
      {tab === 'bans' && (
        <div className="card-viibe overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-viibe">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Motivo</th>
                  <th>Banido em</th>
                  <th>Último IP</th>
                  <th>Tentativas</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton rows={6} cols={7} /> :
                 bans.length === 0 ? (
                  <tr><td colSpan={7}>
                    <EmptyState icon={ShieldCheck} title="Nenhum dispositivo banido"
                      description="Dispositivos banidos aparecem aqui." />
                  </td></tr>
                ) : bans.map(b => (
                  <tr key={b.id}>
                    <td>
                      <code className="text-xs font-mono text-text-secondary">
                        {b.installation_hash_masked}
                      </code>
                    </td>
                    <td className="text-xs max-w-[200px] truncate">{b.reason || '—'}</td>
                    <td className="text-xs">{formatDate(b.banned_at)}</td>
                    <td className="text-xs font-mono text-text-muted">{b.last_seen_ip || '—'}</td>
                    <td>
                      <span className="text-xs font-mono font-bold text-status-warning">
                        {b.attempt_count}
                      </span>
                    </td>
                    <td>
                      {b.is_active ? (
                        <span className="badge-blocked">● Banido</span>
                      ) : (
                        <span className="badge-active">● Desbanido</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {b.is_active && (
                          <button
                            onClick={() => setModal({
                              hash: b.installation_hash_masked,
                              masked: b.installation_hash_masked,
                              action: 'UNBAN',
                            })}
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-success hover:bg-status-success-bg transition-all"
                            title="Desbanir">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary px-3 py-1.5 text-xs">Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">
                {modal.action === 'BAN' ? 'Banir Dispositivo' : 'Desbanir Dispositivo'}
              </h2>
              <button onClick={() => { setModal(null); setReason('') }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background-secondary border border-border">
                <Smartphone className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                <div>
                  <code className="text-xs font-mono text-text-secondary">{modal.masked}</code>
                  {modal.action === 'BAN' && (
                    <p className="text-xs text-status-error mt-1">
                      ⚠️ Este dispositivo não conseguirá usar nenhuma key enquanto banido.
                    </p>
                  )}
                </div>
              </div>

              {modal.action === 'BAN' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Motivo *</label>
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Violação dos termos de uso" className="input-viibe" autoFocus />
                </div>
              )}

              {modal.action === 'UNBAN' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-status-success-bg border border-status-success-border">
                  <ShieldCheck className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                  <p className="text-xs text-status-success">
                    O dispositivo poderá usar keys novamente após ser desbanido.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setModal(null); setReason('') }} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading || (modal.action === 'BAN' && !reason.trim())}
                  className={cn('flex-1', modal.action === 'BAN' ? 'btn-danger' : 'btn-primary')}>
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : modal.action === 'BAN' ? 'Banir' : 'Desbanir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
