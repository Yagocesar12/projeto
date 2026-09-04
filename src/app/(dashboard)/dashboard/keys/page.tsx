'use client'

import { useState, useEffect, useCallback } from 'react'
import { Key, Plus, Search, Copy, RotateCcw, ShieldOff, ShieldCheck, Loader2, X, CheckCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { formatDate, cn } from '@/lib/utils'

interface Duration { value: number; unit: string; label: string; credit_cost: number; permanent?: boolean }
interface License { id: string; key_last4: string; key_prefix: string; duration_label: string; license_status: string; activation_state: string; expires_at: string | null; created_at: string; credit_cost: number }
interface ProfileData { credits: number; unlimited_credits: boolean; role: string }
interface ConfigData { durations: Duration[]; key_prefix: string; default_device_limit: number; max_device_limit: number }

export default function KeysPage() {
  const [tab, setTab] = useState<'generate' | 'manage'>('generate')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ id: string; action: string; key: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, licensesRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/licenses'),
      ])
      if (profileRes.ok) {
        const d = await profileRes.json()
        setProfile(d.profile)
        setConfig(d.config)
        if (d.config?.durations?.length) setSelectedDuration(d.config.durations[0])
      }
      if (licensesRes.ok) {
        const d = await licensesRes.json()
        setLicenses(d.licenses || [])
      }
    } catch { toast.error('Erro ao carregar dados') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerate = async () => {
    if (!selectedDuration || generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_value: selectedDuration.value,
          duration_unit: selectedDuration.unit,
          duration_label: selectedDuration.label,
          credit_cost: selectedDuration.credit_cost,
          permanent: selectedDuration.permanent,
          quantity: profile?.role === 'admin' ? quantity : 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao gerar'); return }
      const keys = data.keys || [data.key]
      setGeneratedKeys(keys)
      toast.success(`${keys.length} key(s) gerada(s)!`)
      fetchData()
    } catch { toast.error('Erro de conexão') }
    finally { setGenerating(false) }
  }

  const copyKey = (key: string, idx: number) => {
    navigator.clipboard.writeText(key)
    setCopiedIdx(idx)
    toast.success('Key copiada!')
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id + action)
    try {
      const res = await fetch(`/api/licenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }
      toast.success('Ação realizada!')
      fetchData()
    } catch { toast.error('Erro de conexão') }
    finally { setActionLoading(null); setConfirmModal(null) }
  }

  const filtered = licenses.filter(l => !search ||
    `${l.key_prefix}-****${l.key_last4}`.includes(search.toUpperCase()) ||
    l.duration_label.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="space-y-4"><TableSkeleton rows={5} cols={5} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <Key className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Keys</h1>
            <p className="text-sm text-text-muted">
              {profile?.unlimited_credits ? '∞ créditos ilimitados' : `${(profile?.credits || 0).toLocaleString('pt-BR')} créditos disponíveis`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['generate', 'manage'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t ? 'text-accent-blue border-accent-blue' : 'text-text-muted border-transparent hover:text-text-secondary')}>
            {t === 'generate' ? 'Gerar' : `Gerenciar (${licenses.length})`}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="space-y-5">
          {generatedKeys.length > 0 && (
            <div className="card-viibe p-5 border-accent-blue/30 bg-accent-blue/5 space-y-3">
              <p className="text-sm font-semibold text-accent-blue">🔑 Keys geradas — salve agora!</p>
              {generatedKeys.map((k, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background-secondary border border-border">
                  <code className="flex-1 text-sm font-mono text-text-primary">{k}</code>
                  <button onClick={() => copyKey(k, i)} className="p-1.5 rounded-lg text-text-muted hover:text-accent-blue transition-all">
                    {copiedIdx === i ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
              <button onClick={() => setGeneratedKeys([])} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                Fechar
              </button>
            </div>
          )}

          <div className="card-viibe p-5 space-y-5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Selecione a duração</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {(config?.durations || []).map(d => (
                <button key={`${d.value}-${d.unit}`} onClick={() => setSelectedDuration(d)}
                  className={cn('p-3 rounded-xl border text-left transition-all',
                    selectedDuration?.label === d.label
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-border bg-background-secondary text-text-secondary hover:border-accent-blue/40')}>
                  <p className="text-sm font-semibold">{d.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{d.credit_cost} créditos</p>
                </button>
              ))}
            </div>

            {profile?.role === 'admin' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Quantidade</label>
                <input type="number" min={1} max={100} value={quantity}
                  onChange={e => setQuantity(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="input-viibe w-32" />
              </div>
            )}

            {selectedDuration && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-background-secondary border border-border">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedDuration.label}</p>
                  <p className="text-xs text-text-muted">
                    {selectedDuration.credit_cost} crédito(s)
                    {profile?.role === 'admin' && quantity > 1 ? ` × ${quantity} = ${selectedDuration.credit_cost * quantity}` : ''}
                  </p>
                </div>
                <button onClick={handleGenerate}
                  disabled={generating || (!profile?.unlimited_credits && (profile?.credits || 0) < selectedDuration.credit_cost * (profile?.role === 'admin' ? quantity : 1))}
                  className="btn-primary flex items-center gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {generating ? 'Gerando...' : 'Gerar Key'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'manage' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar key..." className="input-viibe pl-9" />
          </div>

          <div className="card-viibe overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-viibe">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Duração</th>
                    <th>Status</th>
                    <th>Dispositivo</th>
                    <th>Expira</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6}><EmptyState icon={Key} title="Nenhuma key encontrada" /></td></tr>
                    : filtered.map(l => (
                      <tr key={l.id}>
                        <td><code className="text-xs font-mono font-bold text-accent-blue">{l.key_prefix}-****{l.key_last4}</code></td>
                        <td className="text-xs">{l.duration_label}</td>
                        <td>
                          <span className={cn('text-xs font-medium', l.license_status === 'ACTIVE' ? 'text-green-400' : l.license_status === 'BLOCKED' ? 'text-red-400' : 'text-yellow-400')}>
                            ● {l.license_status}
                          </span>
                        </td>
                        <td className="text-xs text-text-muted">
                          {l.activation_state === 'NEVER_ACTIVATED' ? 'Nunca ativada' : l.activation_state === 'ACTIVE' ? 'Ativa' : 'Expirada'}
                        </td>
                        <td className="text-xs text-text-muted">{l.expires_at ? formatDate(l.expires_at) : '∞'}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setConfirmModal({ id: l.id, action: 'RESET', key: `${l.key_prefix}-****${l.key_last4}` })}
                              className="p-1.5 rounded-lg text-text-muted hover:text-yellow-400 hover:bg-yellow-500/10 transition-all" title="Resetar">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            {l.license_status === 'ACTIVE'
                              ? <button onClick={() => setConfirmModal({ id: l.id, action: 'BLOCK', key: `${l.key_prefix}-****${l.key_last4}` })}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all" title="Bloquear">
                                  <ShieldOff className="w-3.5 h-3.5" />
                                </button>
                              : <button onClick={() => setConfirmModal({ id: l.id, action: 'UNBLOCK', key: `${l.key_prefix}-****${l.key_last4}` })}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-green-400 hover:bg-green-500/10 transition-all" title="Desbloquear">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-sm shadow-modal">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Confirmar</h2>
              <button onClick={() => setConfirmModal(null)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background-secondary border border-border">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-sm text-text-primary">{confirmModal.action} — <span className="font-mono text-accent-blue">{confirmModal.key}</span></p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => handleAction(confirmModal.id, confirmModal.action)} disabled={!!actionLoading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
