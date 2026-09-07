'use client'

import { useState, useEffect } from 'react'
import { Globe, AlertTriangle, Loader2, X, PauseCircle, Wrench, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import type { GlobalControl } from '@/types/database'
import { cn } from '@/lib/utils'

interface ConfirmModal {
  type: string
  label: string
  isActive: boolean
  needsReason: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-status-error' : 'bg-background-tertiary border border-border'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  )
}

const CONTROL_CONFIG = {
  pause_all: { label: 'Pause All Features', description: 'Desativa todas as features imediatamente.', icon: PauseCircle, color: 'text-status-error' },
  maintenance_mode: { label: 'Maintenance Mode', description: 'Exibe mensagem de manutenção para os revendedores.', icon: Wrench, color: 'text-status-warning' },
  global_message: { label: 'Mensagem Global', description: 'Exibe uma mensagem para todos os usuários do painel.', icon: MessageSquare, color: 'text-accent-blue' },
}

export default function GlobalControlsPage() {
  const [controls, setControls] = useState<GlobalControl[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [reason, setReason] = useState('')
  const [globalMessage, setGlobalMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/controls')
      .then(r => r.json())
      .then(d => { setControls(d.data || []); setLoading(false) })
      .catch(() => { toast.error('Erro ao carregar controles'); setLoading(false) })
  }, [])

  const handleToggle = (control: GlobalControl, newValue: boolean) => {
    if (newValue) {
      setConfirmModal({
        type: control.type,
        label: CONTROL_CONFIG[control.type as keyof typeof CONTROL_CONFIG]?.label || control.type,
        isActive: true,
        needsReason: true,
      })
    } else {
      applyControl(control.type, false, '')
    }
  }

  const applyControl = async (type: string, isActive: boolean, reasonText: string, value?: string) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, is_active: isActive, reason: reasonText, value }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro'); return }

      setControls(prev => prev.map(c => c.type === type ? { ...c, is_active: isActive, reason: isActive ? reasonText : null } : c))
      toast.success(`${isActive ? 'Ativado' : 'Desativado'} com sucesso`)
      setConfirmModal(null)
      setReason('')
      setGlobalMessage('')
    } catch { toast.error('Erro de conexão') }
    finally { setActionLoading(false) }
  }

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card-viibe p-5 animate-pulse">
          <div className="h-4 bg-background-tertiary rounded w-48 mb-2" />
          <div className="h-3 bg-background-tertiary rounded w-72" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-status-error-bg border border-status-error-border">
          <Globe className="w-5 h-5 text-status-error" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Global Controls</h1>
          <p className="text-sm text-text-muted">Controles críticos da plataforma</p>
        </div>
      </div>

      {/* Danger zone warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-status-error-bg border border-status-error-border">
        <AlertTriangle className="w-5 h-5 text-status-error mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-status-error">⚠️ Danger Zone</p>
          <p className="text-xs text-status-error/80 mt-1">
            Ações nesta área afetam toda a plataforma imediatamente. Todas as ações são registradas no log de auditoria.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {controls.map(control => {
          const config = CONTROL_CONFIG[control.type as keyof typeof CONTROL_CONFIG]
          if (!config) return null
          const Icon = config.icon

          return (
            <div key={control.id} className={cn(
              'card-viibe p-5 transition-all',
              control.is_active && 'border-status-error/30 bg-status-error-bg/20'
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn('p-2 rounded-lg mt-0.5', control.is_active ? 'bg-status-error-bg' : 'bg-background-tertiary')}>
                    <Icon className={cn('w-4 h-4', control.is_active ? 'text-status-error' : 'text-text-muted')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{config.label}</p>
                      {control.is_active && (
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-status-error text-white uppercase tracking-wider">ATIVO</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{config.description}</p>
                    {control.is_active && control.reason && (
                      <p className="text-xs text-status-error mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Motivo: {control.reason}
                      </p>
                    )}
                  </div>
                </div>
                <Toggle checked={control.is_active} onChange={(v) => handleToggle(control, v)} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-status-error/30 rounded-2xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-status-error">Ativar: {confirmModal.label}</h2>
              <button onClick={() => { setConfirmModal(null); setReason('') }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-status-error-bg border border-status-error-border">
                <AlertTriangle className="w-4 h-4 text-status-error mt-0.5 shrink-0" />
                <p className="text-xs text-status-error">
                  Esta ação afeta todos os usuários imediatamente. Confirme com cautela.
                </p>
              </div>

              {confirmModal.type === 'global_message' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Mensagem *</label>
                  <textarea value={globalMessage} onChange={e => setGlobalMessage(e.target.value)}
                    placeholder="Mensagem que será exibida para todos os usuários..." rows={3}
                    className="input-viibe resize-none" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Motivo *</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Por que está ativando este controle?" className="input-viibe" autoFocus />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setConfirmModal(null); setReason('') }} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => applyControl(confirmModal.type, true, reason, globalMessage || undefined)}
                  disabled={actionLoading || !reason.trim() || (confirmModal.type === 'global_message' && !globalMessage.trim())}
                  className="btn-danger flex-1"
                >
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
