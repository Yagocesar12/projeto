'use client'

import { useState, useEffect } from 'react'
import { Settings, Plus, Zap, Eye, EyeOff, Loader2, CheckCircle2, X, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const GATEWAY_PROVIDERS = [
  { value: 'mercado_pago', label: 'Mercado Pago', icon: '💳' },
  { value: 'efi', label: 'Efí Bank', icon: '🏦' },
  { value: 'manual', label: 'Manual / PIX', icon: '📱' },
]

const PROVIDER_FIELDS: Record<string, { key: string; label: string; secret?: boolean; placeholder: string }[]> = {
  mercado_pago: [
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'APP_USR-...' },
    { key: 'webhook_secret', label: 'Webhook Secret', secret: true, placeholder: 'Chave de assinatura do webhook' },
    { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-...' },
  ],
  efi: [
    { key: 'client_id', label: 'Client ID', placeholder: 'Client_Id_...' },
    { key: 'client_secret', label: 'Client Secret', secret: true, placeholder: 'Client_Secret_...' },
    { key: 'pix_key', label: 'Chave PIX', placeholder: 'Sua chave PIX' },
  ],
  manual: [
    { key: 'pix_key', label: 'Chave PIX', placeholder: 'Sua chave PIX' },
    { key: 'instructions', label: 'Instruções', placeholder: 'Instruções para o pagador' },
  ],
}

interface Gateway {
  id: string; name: string; provider: string; status: string; environment: string
  webhook_url: string | null; last_tested_at: string | null; last_test_success: boolean | null
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<'gateways' | 'credits' | 'notifications'>('gateways')
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [gatewayName, setGatewayName] = useState('')
  const [gatewayEnv, setGatewayEnv] = useState<'sandbox' | 'production'>('sandbox')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/gateways')
      .then(r => r.json())
      .then(d => { setGateways(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSaveGateway = async () => {
    if (!selectedProvider || !gatewayName.trim()) {
      toast.error('Nome e provedor são obrigatórios')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gatewayName.trim(),
          provider: selectedProvider,
          environment: gatewayEnv,
          config,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao salvar'); return }
      toast.success('Gateway configurado!')
      setAddModal(false)
      setSelectedProvider('')
      setGatewayName('')
      setConfig({})

      const refreshed = await fetch('/api/admin/gateways').then(r => r.json())
      setGateways(refreshed.data || [])
    } catch { toast.error('Erro de conexão') }
    finally { setSaving(false) }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/admin/gateways/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (data.success) toast.success('Conexão OK!')
      else toast.error('Falha na conexão: ' + (data.error || 'Erro desconhecido'))
    } catch { toast.error('Erro de conexão') }
    finally { setTesting(null) }
  }

  const STATUS_COLOR: Record<string, string> = {
    active: 'text-status-success', inactive: 'text-text-muted', testing: 'text-status-warning',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <Settings className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configurações</h1>
          <p className="text-sm text-text-muted">Configurações globais da plataforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['gateways', 'credits', 'notifications'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px capitalize',
              tab === t ? 'text-accent-blue border-accent-blue' : 'text-text-muted border-transparent hover:text-text-secondary')}>
            {t === 'gateways' ? 'Gateways' : t === 'credits' ? 'Créditos' : 'Notificações'}
          </button>
        ))}
      </div>

      {/* Gateways tab */}
      {tab === 'gateways' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-text-muted">Configurações de gateways de pagamento</p>
            <button onClick={() => setAddModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Adicionar Gateway
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="card-viibe p-5 h-24 shimmer-bg" />)}
            </div>
          ) : gateways.length === 0 ? (
            <div className="card-viibe p-10 text-center">
              <Zap className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-text-secondary">Nenhum gateway configurado</p>
              <p className="text-xs text-text-muted mt-1">Adicione um gateway de pagamento para ativar recargas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gateways.map(gw => (
                <div key={gw.id} className="card-viibe p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-text-primary">{gw.name}</p>
                        <span className={cn('text-xs font-medium', STATUS_COLOR[gw.status] || 'text-text-muted')}>
                          ● {gw.status}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-2xs bg-background-tertiary border border-border text-text-muted">
                          {gw.environment}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {GATEWAY_PROVIDERS.find(p => p.value === gw.provider)?.label || gw.provider}
                      </p>
                      {gw.last_tested_at && (
                        <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                          {gw.last_test_success
                            ? <CheckCircle2 className="w-3 h-3 text-status-success" />
                            : <X className="w-3 h-3 text-status-error" />}
                          Último teste: {new Date(gw.last_tested_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <button onClick={() => handleTest(gw.id)} disabled={testing === gw.id} className="btn-secondary text-xs px-3 py-1.5">
                      {testing === gw.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wifi className="w-3.5 h-3.5" />Testar</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credits tab */}
      {tab === 'credits' && (
        <div className="card-viibe p-6 space-y-5">
          <h2 className="text-sm font-semibold text-text-primary">Sistema de Créditos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Valor mínimo de recarga (R$)', placeholder: '10' },
              { label: 'Valor máximo de recarga (R$)', placeholder: '10000' },
              { label: 'Créditos por R$ 1,00', placeholder: '100' },
              { label: 'Bônus de recarga (%)', placeholder: '0' },
            ].map(f => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">{f.label}</label>
                <input type="number" placeholder={f.placeholder} className="input-viibe" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-background-secondary border border-border">
            <div>
              <p className="text-sm font-medium text-text-primary">Aprovação automática</p>
              <p className="text-xs text-text-muted mt-0.5">Aprovar recargas confirmadas pelo webhook automaticamente</p>
            </div>
            <div className="w-10 h-5 rounded-full bg-background-tertiary border border-border relative cursor-pointer">
              <div className="w-3.5 h-3.5 rounded-full bg-text-muted absolute top-0.5 left-0.5 transition-transform" />
            </div>
          </div>
          <button className="btn-primary">Salvar configurações</button>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="card-viibe p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Notificações</h2>
          {[
            'Recarga aprovada — notificar revendedor',
            'Recarga recusada — notificar revendedor',
            'Nova recarga — notificar admin',
            'Conta bloqueada — notificar usuário',
          ].map(label => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <span className="text-sm text-text-secondary">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Email</span>
                <div className="w-8 h-4 rounded-full bg-accent-blue relative cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 right-0.5" />
                </div>
              </div>
            </div>
          ))}
          <button className="btn-primary">Salvar preferências</button>
        </div>
      )}

      {/* Add gateway modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-lg shadow-modal animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background-card z-10">
              <h2 className="text-base font-bold text-text-primary">Adicionar Gateway</h2>
              <button onClick={() => setAddModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Provider selection */}
              {!selectedProvider ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Selecione o provedor</p>
                  {GATEWAY_PROVIDERS.map(p => (
                    <button key={p.value} onClick={() => setSelectedProvider(p.value)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent-blue/50 hover:bg-accent-blue/5 transition-all text-left">
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-sm font-medium text-text-primary">{p.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setSelectedProvider('')}
                      className="text-xs text-accent-blue hover:text-accent-blue-glow">← Voltar</button>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-secondary">{GATEWAY_PROVIDERS.find(p => p.value === selectedProvider)?.label}</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Nome *</label>
                    <input type="text" value={gatewayName} onChange={e => setGatewayName(e.target.value)}
                      placeholder="Ex: Mercado Pago Principal" className="input-viibe" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Ambiente</label>
                    <div className="flex gap-2">
                      {(['sandbox', 'production'] as const).map(env => (
                        <button key={env} onClick={() => setGatewayEnv(env)}
                          className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
                            gatewayEnv === env ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-border text-text-muted hover:border-border-strong')}>
                          {env === 'sandbox' ? 'Sandbox (Teste)' : 'Produção'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider-specific fields */}
                  {PROVIDER_FIELDS[selectedProvider]?.map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">{field.label}</label>
                      <div className="relative">
                        <input
                          type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                          value={config[field.key] || ''}
                          onChange={e => setConfig(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="input-viibe pr-10"
                        />
                        {field.secret && (
                          <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [field.key]: !p[field.key] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-1">
                            {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddModal(false)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={handleSaveGateway} disabled={saving} className="btn-primary flex-1">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
