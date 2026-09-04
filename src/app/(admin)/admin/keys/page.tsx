'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MoreHorizontal, Plus, Loader2, X, Copy, CheckCheck, AlertTriangle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, cn } from '@/lib/utils'
import { Key } from 'lucide-react'

interface License {
  id: string; key_hash: string; key_last4: string; key_prefix: string
  license_status: string; activation_state: string; duration_label: string
  expires_at: string | null; created_at: string; credit_cost: number
  owner?: { id: string; username: string }
  current_device_hash?: string
}

interface Duration { value: number; unit: string; label: string; credit_cost: number; permanent?: boolean }

interface MenuState { id: string; key: string; status: string; deviceBanned: boolean; x: number; y: number }
interface ConfirmModal { title: string; description: string; action: () => void }

export default function AdminKeysPage() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const globalMenuRef = useRef<HTMLDivElement>(null)

  // Generate state
  const [durations, setDurations] = useState<Duration[]>([])
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [copiedKeyIdx, setCopiedKeyIdx] = useState<number | null>(null)

  const fetchLicenses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/keys?${params}`)
      const data = await res.json()
      setLicenses(data.keys || data.data || [])
      setTotal(data.total || 0)
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchLicenses() }, [fetchLicenses])

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      const dur = d.config?.durations || []
      setDurations(dur)
      if (dur.length) setSelectedDuration(dur[0])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
      if (globalMenuRef.current && !globalMenuRef.current.contains(e.target as Node)) setGlobalMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openMenu = (e: React.MouseEvent, l: License) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({
      id: l.id,
      key: `${l.key_prefix}-****${l.key_last4}`,
      status: l.license_status,
      deviceBanned: false,
      x: rect.right,
      y: rect.bottom + 4,
    })
  }

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/licenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }
      toast.success('Ação realizada')
      setConfirmModal(null)
      fetchLicenses()
    } catch { toast.error('Erro de conexão') }
  }

  const handleGenerate = async () => {
    if (!selectedDuration || generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_value: selectedDuration.value,
          duration_unit: selectedDuration.unit,
          duration_label: selectedDuration.label,
          credit_cost: selectedDuration.credit_cost,
          permanent: selectedDuration.permanent,
          quantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }
      setGeneratedKeys(data.keys || [data.key])
      toast.success(`${quantity} key(s) gerada(s)!`)
      fetchLicenses()
    } catch { toast.error('Erro de conexão') }
    finally { setGenerating(false) }
  }

  const copyKey = (key: string, idx?: number) => {
    navigator.clipboard.writeText(key)
    toast.success('Copiada!')
    if (idx !== undefined) { setCopiedKeyIdx(idx); setTimeout(() => setCopiedKeyIdx(null), 2000) }
  }

  const toggleSelect = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () => setSelected(s => s.length === licenses.length ? [] : licenses.map(l => l.id))

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Keys</h2>
        <p className="text-xs text-text-muted mt-0.5">{total.toLocaleString('pt-BR')} licença(s) no sistema</p>
      </div>

      {/* SECTION 1: Generate */}
      <div className="card-ghost p-5 animate-stagger-1">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Gerar key</p>

        {generatedKeys.length > 0 && (
          <div className="mb-4 p-4 rounded-md bg-background-tertiary border border-border space-y-2">
            <p className="text-xs font-medium text-text-primary">🔑 Keys geradas — salve agora</p>
            {generatedKeys.map((k, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded bg-white border border-border">
                <code className="flex-1 text-xs font-mono text-text-primary">{k}</code>
                <button onClick={() => copyKey(k, i)} className="p-1 text-text-muted hover:text-text-primary transition-all">
                  {copiedKeyIdx === i ? <CheckCheck className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            <button onClick={() => setGeneratedKeys([])} className="text-xs text-text-muted hover:text-text-secondary">Fechar</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {durations.map(d => (
            <button key={`${d.value}-${d.unit}`} onClick={() => setSelectedDuration(d)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                selectedDuration?.label === d.label
                  ? 'bg-accent-black text-white border-accent-black'
                  : 'bg-white text-text-secondary border-border hover:border-border-strong')}>
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">Qtd:</label>
            <input type="number" min={1} max={100} value={quantity}
              onChange={e => setQuantity(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="input-ghost w-20" />
          </div>
          {selectedDuration && (
            <span className="text-xs text-text-muted">
              {selectedDuration.credit_cost * quantity} crédito(s)
            </span>
          )}
          <button onClick={handleGenerate} disabled={generating || !selectedDuration} className="btn-black ml-auto">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Gerar key
          </button>
        </div>
      </div>

      {/* SECTION 2: Manage */}
      <div className="space-y-3 animate-stagger-2">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Gerenciar keys</p>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar key..."
              className="input-ghost pl-9 w-48" />
          </div>
          {/* Global actions */}
          <div className="relative" ref={globalMenuRef}>
            <button onClick={() => setGlobalMenuOpen(o => !o)}
              className="btn-ghost flex items-center gap-1.5">
              Ações globais
              <ChevronDown className="w-3 h-3" />
            </button>
            {globalMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-border rounded-lg py-1 min-w-[172px] shadow-dropdown animate-scale-in">
                {[
                  { label: 'Pausar todas', action: 'GLOBAL_PAUSE' },
                  { label: 'Bloquear todas', action: 'GLOBAL_BLOCK' },
                  { label: 'Resetar todas', action: 'GLOBAL_RESET' },
                ].map(item => (
                  <button key={item.action} className="dropdown-item" onClick={() => {
                    setGlobalMenuOpen(false)
                    setConfirmModal({
                      title: item.label,
                      description: `Confirmar: ${item.label}? Esta ação afeta todas as keys do sistema.`,
                      action: () => handleAction('global', item.action),
                    })
                  }}>{item.label}</button>
                ))}
                <div className="border-t border-border my-1" />
                <button className="dropdown-item danger" onClick={() => {
                  setGlobalMenuOpen(false)
                  setConfirmModal({
                    title: 'Limpar expiradas',
                    description: 'Excluir permanentemente todas as keys expiradas?',
                    action: () => handleAction('global', 'CLEAR_EXPIRED'),
                  })
                }}>Limpar expiradas</button>
              </div>
            )}
          </div>
        </div>

        {/* Selection bar */}
        {selected.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-md bg-accent-black text-white text-xs animate-scale-in">
            <span className="font-medium">{selected.length} selecionada(s)</span>
            <div className="flex-1" />
            {['Resetar', 'Bloquear', 'Excluir'].map(a => (
              <button key={a} onClick={() => setConfirmModal({
                title: `${a} ${selected.length} key(s)`,
                description: `Confirmar ${a.toLowerCase()} das ${selected.length} keys selecionadas?`,
                action: () => { selected.forEach(id => handleAction(id, a.toUpperCase())); setSelected([]) },
              })} className="hover:opacity-75 transition-opacity">{a}</button>
            ))}
            <button onClick={() => setSelected([])}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="card-ghost overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-ghost">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" checked={selected.length === licenses.length && licenses.length > 0}
                      onChange={toggleAll} className="rounded border-border" />
                  </th>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Duração</th>
                  <th>Revendedor</th>
                  <th>Criada em</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton rows={8} cols={7} /> :
                 licenses.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon={Key} title="Nenhuma key encontrada" /></td></tr>
                ) : licenses.map(l => (
                  <tr key={l.id} className={selected.includes(l.id) ? 'bg-background-secondary' : ''}>
                    <td>
                      <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelect(l.id)}
                        className="rounded border-border" />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-medium text-text-primary">
                          {l.key_prefix}-****{l.key_last4}
                        </code>
                        <button onClick={() => { copyKey(`${l.key_prefix}-****${l.key_last4}`); setCopiedId(l.id); setTimeout(() => setCopiedId(null), 2000) }}
                          className="p-0.5 text-text-muted hover:text-text-primary transition-all">
                          {copiedId === l.id ? <CheckCheck className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td><StatusBadge status={l.license_status} /></td>
                    <td className="text-xs text-text-muted">{l.duration_label}</td>
                    <td className="text-xs text-text-muted">{l.owner ? `@${l.owner.username}` : '—'}</td>
                    <td className="text-xs text-text-muted">{formatDate(l.created_at)}</td>
                    <td>
                      <button onClick={e => openMenu(e, l)}
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
      </div>

      {/* Key context menu */}
      {menu && (
        <div ref={menuRef}
          className="fixed z-50 bg-white border border-border rounded-lg py-1 min-w-[160px] shadow-dropdown animate-scale-in"
          style={{ left: menu.x, top: menu.y, transformOrigin: 'top right' }}>
          <button className="dropdown-item" onClick={() => {
            setConfirmModal({ title: 'Resetar key', description: `Resetar vínculo de dispositivo da key ${menu.key}?`, action: () => handleAction(menu.id, 'RESET') })
            setMenu(null)
          }}>Resetar key</button>
          {menu.status === 'ACTIVE' ? (
            <button className="dropdown-item danger" onClick={() => {
              setConfirmModal({ title: 'Bloquear key', description: `Bloquear ${menu.key}?`, action: () => handleAction(menu.id, 'BLOCK') })
              setMenu(null)
            }}>Bloquear key</button>
          ) : (
            <button className="dropdown-item" onClick={() => {
              setConfirmModal({ title: 'Desbloquear key', description: `Desbloquear ${menu.key}?`, action: () => handleAction(menu.id, 'UNBLOCK') })
              setMenu(null)
            }}>Desbloquear key</button>
          )}
          <div className="border-t border-border my-1" />
          <button className="dropdown-item danger" onClick={() => {
            setConfirmModal({ title: 'Banir dispositivo', description: `Banir o dispositivo vinculado à key ${menu.key}? O device não poderá usar nenhuma key enquanto banido.`, action: () => handleAction(menu.id, 'BAN_DEVICE') })
            setMenu(null)
          }}>Banir dispositivo</button>
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
