'use client'

import { useState, useEffect } from 'react'
import { Cpu, Loader2, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { FeatureFlag } from '@/types/database'

function Toggle({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue',
        checked ? 'bg-status-success' : 'bg-background-tertiary border border-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  )
}

interface ReasonModal {
  featureId: string
  field: 'ff_normal' | 'ff_max'
  label: string
}

export default function FeatureControlPage() {
  const [features, setFeatures] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [reasonModal, setReasonModal] = useState<ReasonModal | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    fetch('/api/features')
      .then(r => r.json())
      .then(d => { setFeatures(d.data || []); setLoading(false) })
      .catch(() => { toast.error('Erro ao carregar features'); setLoading(false) })
  }, [])

  const handleToggle = async (
    feature: FeatureFlag,
    field: 'ff_normal' | 'ff_max',
    value: boolean
  ) => {
    // If disabling, ask for reason
    if (!value) {
      setReasonModal({ featureId: feature.id, field, label: feature.label })
      return
    }

    await applyToggle(feature.id, field, value, '')
  }

  const applyToggle = async (
    featureId: string,
    field: 'ff_normal' | 'ff_max',
    value: boolean,
    reasonText: string
  ) => {
    const key = `${featureId}-${field}`
    setUpdating(key)

    try {
      const res = await fetch('/api/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: featureId, field, value, reason: reasonText }),
      })

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error || 'Erro ao atualizar')
        return
      }

      setFeatures(prev => prev.map(f =>
        f.id === featureId ? { ...f, [field]: value } : f
      ))
      toast.success(`Feature ${value ? 'ativada' : 'desativada'}`)
      setReasonModal(null)
      setReason('')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <Cpu className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Feature Control</h1>
          <p className="text-sm text-text-muted mt-0.5">Controle as features disponíveis na plataforma</p>
        </div>
      </div>

      <div className="card-viibe overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-xs text-text-muted">
            Desativar uma feature bloqueia o acesso para todos os revendedores. As mudanças são aplicadas imediatamente.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-viibe">
            <thead>
              <tr>
                <th>Feature</th>
                <th className="text-center">FF Normal</th>
                <th className="text-center">FF MAX</th>
                <th className="text-center">Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-4 w-32" /></td>
                    <td className="text-center"><Skeleton className="h-5 w-9 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-5 w-9 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : features.map(f => (
                <tr key={f.id}>
                  <td>
                    <div>
                      <p className="text-sm font-semibold text-text-primary font-mono">{f.label}</p>
                      {f.disable_reason && (
                        <p className="text-xs text-status-error mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {f.disable_reason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center items-center gap-2">
                      {updating === `${f.id}-ff_normal` ? (
                        <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                      ) : (
                        <Toggle
                          checked={f.ff_normal}
                          onChange={(v) => handleToggle(f, 'ff_normal', v)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center items-center gap-2">
                      {updating === `${f.id}-ff_max` ? (
                        <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                      ) : (
                        <Toggle
                          checked={f.ff_max}
                          onChange={(v) => handleToggle(f, 'ff_max', v)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    {f.has_file ? (
                      <span className="text-xs text-accent-blue font-medium">Upload / Ver</span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason modal */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Desativar Feature</h2>
              <button onClick={() => { setReasonModal(null); setReason('') }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-status-warning-bg border border-status-warning-border">
                <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
                <p className="text-xs text-status-warning">
                  Desativar <strong>{reasonModal.label}</strong> ({reasonModal.field === 'ff_normal' ? 'FF Normal' : 'FF MAX'}) bloqueará o acesso imediatamente.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Motivo (opcional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex: Manutenção programada"
                  className="input-viibe"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setReasonModal(null); setReason('') }} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => applyToggle(reasonModal.featureId, reasonModal.field, false, reason)}
                  className="btn-danger flex-1"
                >
                  Desativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
