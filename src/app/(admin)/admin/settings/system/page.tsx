'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Loader2, Key } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Duration {
  value: number; unit: string; label: string; credit_cost: number; permanent?: boolean
}

const ALL_DURATIONS: Duration[] = [
  { value: 1,  unit: 'HOURS', label: '1 hora',   credit_cost: 5 },
  { value: 1,  unit: 'DAYS',  label: '1 dia',    credit_cost: 10 },
  { value: 7,  unit: 'DAYS',  label: '7 dias',   credit_cost: 50 },
  { value: 15, unit: 'DAYS',  label: '15 dias',  credit_cost: 80 },
  { value: 16, unit: 'DAYS',  label: '16 dias',  credit_cost: 85 },
  { value: 17, unit: 'DAYS',  label: '17 dias',  credit_cost: 90 },
  { value: 18, unit: 'DAYS',  label: '18 dias',  credit_cost: 95 },
  { value: 19, unit: 'DAYS',  label: '19 dias',  credit_cost: 100 },
  { value: 30, unit: 'DAYS',  label: '30 dias',  credit_cost: 150 },
  { value: 60, unit: 'DAYS',  label: '60 dias',  credit_cost: 250 },
  { value: 90, unit: 'DAYS',  label: '90 dias',  credit_cost: 350 },
  { value: 0,  unit: 'DAYS',  label: 'Permanente', credit_cost: 500, permanent: true },
]

export default function AdminSystemSettingsPage() {
  const [prefix, setPrefix] = useState('GHOST')
  const [enabledDurations, setEnabledDurations] = useState<string[]>([])
  const [resellerDurations, setResellerDurations] = useState<number[]>([])
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/system-config')
      .then(r => r.json())
      .then(d => {
        const c = d.config || {}
        setPrefix(String(c.key_prefix || 'GHOST').replace(/^"|"$/g, ''))

        const allowed: Duration[] = c.allowed_durations || ALL_DURATIONS
        const keys = allowed.map((d: Duration) => d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`)
        setEnabledDurations(keys)

        const costs: Record<string, number> = {}
        allowed.forEach((d: Duration) => {
          costs[d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`] = d.credit_cost
        })
        setCreditCosts(costs)
        setResellerDurations(c.reseller_allowed_durations || [1, 7, 15, 30])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const saveSetting = async (key: string, value: unknown) => {
    setSaving(key)
    try {
      const res = await fetch('/api/admin/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }
      toast.success('Salvo!')
    } catch { toast.error('Erro de conexão') }
    finally { setSaving(null) }
  }

  const saveDurations = async () => {
    const selected = ALL_DURATIONS
      .filter(d => enabledDurations.includes(d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`))
      .map(d => ({
        ...d,
        credit_cost: creditCosts[d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`] || d.credit_cost,
      }))
    await saveSetting('allowed_durations', selected)
    await saveSetting('reseller_allowed_durations', resellerDurations)
  }

  const toggleDuration = (key: string) => {
    setEnabledDurations(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const toggleResellerDuration = (value: number) => {
    setResellerDurations(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  if (loading) return <div className="card-viibe p-10 shimmer-bg rounded-xl h-64" />

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <Settings className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configurações do Sistema</h1>
          <p className="text-sm text-text-muted">Keys, durações e permissões</p>
        </div>
      </div>

      {/* Prefixo */}
      <div className="card-viibe p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-accent-blue" />
          <h2 className="text-sm font-semibold text-text-primary">Prefixo das Keys</h2>
        </div>
        <p className="text-xs text-text-muted">Keys antigas não são alteradas. Somente novas keys usarão o novo prefixo.</p>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Prefixo</label>
            <input type="text" value={prefix}
              onChange={e => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="GHOST" maxLength={20}
              className="input-viibe font-mono text-accent-blue" />
            <p className="text-xs text-text-muted">Preview: <span className="font-mono text-text-secondary">{prefix || 'GHOST'}-XXXXX-XXXXX-XXXXX-XXXXX</span></p>
          </div>
          <div className="flex items-end">
            <button onClick={() => saveSetting('key_prefix', prefix)} disabled={saving === 'key_prefix'} className="btn-primary">
              {saving === 'key_prefix' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Durações */}
      <div className="card-viibe p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Durações disponíveis</h2>
        <p className="text-xs text-text-muted">Configure quais durações existem no sistema e seus custos em créditos.</p>

        <div className="space-y-2">
          {ALL_DURATIONS.map(d => {
            const key = d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`
            const enabled = enabledDurations.includes(key)
            return (
              <div key={key} className={cn('flex items-center gap-3 p-3 rounded-xl border transition-all',
                enabled ? 'border-border bg-background-secondary' : 'border-border/50 bg-background-secondary/30 opacity-60')}>
                <input type="checkbox" checked={enabled} onChange={() => toggleDuration(key)}
                  className="w-4 h-4 rounded accent-accent-blue" />
                <span className="text-sm font-medium text-text-primary w-24 shrink-0">{d.label}</span>
                {enabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-text-muted">Custo:</span>
                    <input type="number" min={0} value={creditCosts[key] || d.credit_cost}
                      onChange={e => setCreditCosts(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      className="input-viibe w-24 py-1 text-xs font-mono" />
                    <span className="text-xs text-text-muted">créditos</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="pt-2 border-t border-border">
          <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Permitir para resellers</h3>
          <div className="flex flex-wrap gap-2">
            {ALL_DURATIONS.filter(d => enabledDurations.includes(d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`)).map(d => (
              <button key={d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`}
                onClick={() => d.permanent ? null : toggleResellerDuration(d.value)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  (d.permanent ? false : resellerDurations.includes(d.value))
                    ? 'bg-accent-blue text-white border-accent-blue'
                    : 'border-border text-text-muted hover:border-border-strong')}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={saveDurations} disabled={saving === 'allowed_durations'} className="btn-primary">
          {saving === 'allowed_durations' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar durações
        </button>
      </div>
    </div>
  )
}
