'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface RemoteConfig {
  version_current: string
  version_minimum: string
  version_recommended: string
  update_url: string | null
  force_update: boolean
  maintenance_mode: boolean
  maintenance_message: string | null
}

export default function RemoteConfigPage() {
  const [config, setConfig] = useState<RemoteConfig>({
    version_current: '1.0.0',
    version_minimum: '1.0.0',
    version_recommended: '1.0.0',
    update_url: '',
    force_update: false,
    maintenance_mode: false,
    maintenance_message: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/remote-config')
      .then(r => r.json())
      .then(d => { if (d.data) setConfig({ ...config, ...d.data }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/remote-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao salvar'); return }
      toast.success('Remote Config salvo!')
    } catch { toast.error('Erro de conexão') }
    finally { setSaving(false) }
  }

  const update = (key: keyof RemoteConfig, value: unknown) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-viibe p-5 h-16 shimmer-bg rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <Smartphone className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Remote Config</h1>
          <p className="text-sm text-text-muted">Configurações consultadas pela IPA em tempo real</p>
        </div>
      </div>

      {/* Versões */}
      <div className="card-viibe p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Versões do Aplicativo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'version_current', label: 'Versão atual', placeholder: '1.5.0' },
            { key: 'version_minimum', label: 'Versão mínima', placeholder: '1.4.0' },
            { key: 'version_recommended', label: 'Versão recomendada', placeholder: '1.5.0' },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">{f.label}</label>
              <input type="text" value={(config as any)[f.key] || ''}
                onChange={e => update(f.key as keyof RemoteConfig, e.target.value)}
                placeholder={f.placeholder} className="input-viibe font-mono" />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">URL de atualização</label>
          <input type="url" value={config.update_url || ''}
            onChange={e => update('update_url', e.target.value)}
            placeholder="https://apps.apple.com/app/..." className="input-viibe" />
        </div>
      </div>

      {/* Toggles */}
      <div className="card-viibe p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Controles</h2>

        {[
          { key: 'force_update', label: 'Atualização obrigatória', desc: 'Força o usuário a atualizar para a versão mínima' },
          { key: 'maintenance_mode', label: 'Modo manutenção', desc: 'Exibe mensagem de manutenção na IPA' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-background-secondary border border-border">
            <div>
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => update(item.key as keyof RemoteConfig, !(config as any)[item.key])}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                (config as any)[item.key] ? 'bg-accent-blue' : 'bg-background-tertiary border border-border')}>
              <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                (config as any)[item.key] ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
        ))}

        {config.maintenance_mode && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Mensagem de manutenção</label>
            <textarea value={config.maintenance_message || ''}
              onChange={e => update('maintenance_message', e.target.value)}
              placeholder="Sistema em manutenção. Voltamos em breve!"
              rows={3} className="input-viibe resize-none" />
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><Save className="w-4 h-4" />Salvar configurações</>}
      </button>
    </div>
  )
}
