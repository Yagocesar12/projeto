'use client'

import { useState } from 'react'
import { Key, Plus, Copy, CheckCheck, Loader2, Infinity, ChevronRight, X, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

interface Duration {
  value: number
  unit: string
  label: string
  credit_cost: number
  permanent?: boolean
}

interface GenerateLicenseClientProps {
  credits: number
  unlimitedCredits: boolean
  isAdmin: boolean
  durations: Duration[]
  keyPrefix: string
  defaultDeviceLimit: number
  maxDeviceLimit: number
}

interface GeneratedLicense {
  key: string
  last4: string
  duration: string
  license_id: string
  balance_after: number
}

export function GenerateLicenseClient({
  credits, unlimitedCredits, isAdmin, durations, keyPrefix,
  defaultDeviceLimit, maxDeviceLimit,
}: GenerateLicenseClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm' | 'result'>('form')
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(null)
  const [deviceLimit, setDeviceLimit] = useState(defaultDeviceLimit)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generatedLicenses, setGeneratedLicenses] = useState<GeneratedLicense[]>([])
  const [currentCredits, setCurrentCredits] = useState(credits)
  const [session, setSession] = useState<GeneratedLicense[]>([])

  const getDurationKey = (d: Duration) =>
    d.permanent ? 'PERMANENT' : `${d.value}-${d.unit}`

  const totalCost = selectedDuration ? selectedDuration.credit_cost * quantity : 0
  const canGenerate = unlimitedCredits || currentCredits >= totalCost

  const closeModal = () => {
    setModalOpen(false)
    setStep('form')
    setSelectedDuration(null)
    setQuantity(1)
    setDeviceLimit(defaultDeviceLimit)
  }

  const handleGenerate = async () => {
    if (!selectedDuration || loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationKey: getDurationKey(selectedDuration),
          deviceLimit,
          quantity,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        const errMap: Record<string, string> = {
          INSUFFICIENT_CREDITS: 'Créditos insuficientes',
          DURATION_NOT_ALLOWED: 'Duração não permitida',
          DURATION_NOT_ALLOWED_FOR_RESELLER: 'Duração não disponível para resellers',
          ACCOUNT_BLOCKED: 'Conta bloqueada',
        }
        toast.error(errMap[data.error] || data.error || 'Erro ao gerar key')
        return
      }

      const licenses: GeneratedLicense[] = data.licenses || []
      setGeneratedLicenses(licenses)
      setSession(prev => [...licenses, ...prev].slice(0, 20))

      if (!unlimitedCredits && licenses[0]?.balance_after !== undefined) {
        setCurrentCredits(licenses[0].balance_after)
      }

      setStep('result')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('Key copiada!')
  }

  const copyAll = () => {
    const text = generatedLicenses.map(l => l.key).join('\n')
    navigator.clipboard.writeText(text)
    toast.success(`${generatedLicenses.length} key(s) copiadas!`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Gerar Key</h1>
          <p className="text-sm text-text-muted mt-0.5">Prefixo atual: <span className="font-mono text-accent-blue">{keyPrefix}</span></p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background-card border border-border">
          {unlimitedCredits ? (
            <Infinity className="w-4 h-4 text-accent-blue" />
          ) : (
            <span className="text-sm font-mono font-bold text-accent-blue">{currentCredits.toLocaleString('pt-BR')}</span>
          )}
          <span className="text-xs text-text-muted">créditos</span>
        </div>
      </div>

      {/* Generate card */}
      <div className="card-viibe p-8 text-center animate-stagger-1">
        {durations.length === 0 ? (
          <EmptyState icon={Key} title="Nenhuma duração disponível"
            description="O administrador precisa configurar as durações permitidas." />
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto">
              <Key className="w-7 h-7 text-accent-blue" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Gerar nova key</h2>
              <p className="text-sm text-text-muted mt-1">{durations.length} duração(ões) disponível(eis)</p>
            </div>
            <button onClick={() => setModalOpen(true)} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" />
              Gerar Key
            </button>
          </div>
        )}
      </div>

      {/* Session keys */}
      {session.length > 0 && (
        <div className="card-viibe p-5 animate-stagger-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Geradas nesta sessão</h2>
            <span className="text-xs text-text-muted">{session.length} key(s)</span>
          </div>
          <div className="space-y-2">
            {session.map((l, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-border">
                <div>
                  <p className="text-xs font-mono font-bold text-accent-blue">{l.key}</p>
                  <p className="text-xs text-text-muted mt-0.5">{l.duration}</p>
                </div>
                <button onClick={() => copyKey(l.key)}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-all">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-md shadow-modal animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background-card z-10">
              <h2 className="text-base font-bold text-text-primary">
                {step === 'form' ? 'Configurar Key' : step === 'confirm' ? 'Confirmar' : `${generatedLicenses.length} Key(s) Gerada(s)!`}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP: FORM */}
            {step === 'form' && (
              <div className="p-5 space-y-5">
                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Duração</label>
                  <div className="grid grid-cols-2 gap-2">
                    {durations.map(d => (
                      <button key={`${d.value}-${d.unit}`}
                        onClick={() => setSelectedDuration(d)}
                        className={cn('flex flex-col items-center p-3 rounded-xl border transition-all',
                          selectedDuration && (d.permanent ? selectedDuration.permanent : selectedDuration.value === d.value && selectedDuration.unit === d.unit)
                            ? 'border-accent-blue bg-accent-blue/10'
                            : 'border-border bg-background-secondary hover:border-border-strong')}>
                        <span className={cn('text-sm font-semibold', selectedDuration?.value === d.value ? 'text-text-primary' : 'text-text-secondary')}>
                          {d.label}
                        </span>
                        <span className="text-xs font-mono text-accent-blue mt-1">{d.credit_cost} cr</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device limit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    <Smartphone className="w-3.5 h-3.5 inline mr-1" />
                    Limite de dispositivos
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={maxDeviceLimit} value={deviceLimit}
                      onChange={e => setDeviceLimit(parseInt(e.target.value))}
                      className="flex-1 accent-accent-blue" />
                    <span className="w-8 text-center font-mono font-bold text-text-primary text-sm">{deviceLimit}</span>
                  </div>
                </div>

                {/* Quantity (admin only) */}
                {isAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Quantidade (máx. 50)</label>
                    <input type="number" min={1} max={50} value={quantity}
                      onChange={e => setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="input-viibe" />
                  </div>
                )}

                {/* Cost summary */}
                {selectedDuration && (
                  <div className="p-3 rounded-xl bg-background-secondary border border-border space-y-2 text-sm">
                    {[
                      ['Duração', selectedDuration.label],
                      ['Custo', `${totalCost.toLocaleString('pt-BR')} créditos`],
                      ['Saldo atual', unlimitedCredits ? '∞' : currentCredits.toLocaleString('pt-BR')],
                      ...(!unlimitedCredits ? [['Saldo após', (currentCredits - totalCost).toLocaleString('pt-BR')]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-text-muted">{label}</span>
                        <span className={cn('font-medium', label === 'Saldo após' && !canGenerate ? 'text-status-error' : 'text-text-primary')}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => selectedDuration && canGenerate && setStep('confirm')}
                  disabled={!selectedDuration || !canGenerate}
                  className="btn-primary w-full">
                  {!canGenerate ? 'Créditos insuficientes' : 'Continuar'}
                  {canGenerate && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* STEP: CONFIRM */}
            {step === 'confirm' && selectedDuration && (
              <div className="p-5 space-y-4">
                <div className="p-4 rounded-xl bg-background-secondary border border-border space-y-3 text-sm">
                  {[
                    ['Prefixo', keyPrefix],
                    ['Duração', selectedDuration.label],
                    ['Dispositivos', String(deviceLimit)],
                    ...(isAdmin ? [['Quantidade', String(quantity)]] : []),
                    ['Custo total', `${totalCost.toLocaleString('pt-BR')} créditos`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-text-muted">{label}</span>
                      <span className="font-medium text-text-primary">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('form')} className="btn-secondary flex-1">Voltar</button>
                  <button onClick={handleGenerate} disabled={loading} className="btn-primary flex-1">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP: RESULT */}
            {step === 'result' && generatedLicenses.length > 0 && (
              <div className="p-5 space-y-4">
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-xl bg-status-success-bg border border-status-success-border flex items-center justify-center mx-auto mb-3">
                    <CheckCheck className="w-6 h-6 text-status-success" />
                  </div>
                  <p className="text-sm text-text-muted">{generatedLicenses.length} key(s) gerada(s)</p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {generatedLicenses.map((l, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background-secondary border border-accent-blue/20">
                      <p className="font-mono text-xs font-bold text-text-primary break-all flex-1 mr-2">{l.key}</p>
                      <button onClick={() => copyKey(l.key)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-all shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {generatedLicenses.length > 1 && (
                  <button onClick={copyAll} className="btn-secondary w-full">
                    <Copy className="w-4 h-4" />
                    Copiar todas ({generatedLicenses.length})
                  </button>
                )}

                <p className="text-xs text-status-warning text-center">
                  ⚠️ Guarde as keys agora. Elas não serão exibidas novamente completas.
                </p>
                <button onClick={closeModal} className="btn-secondary w-full">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
