'use client'

import { useState } from 'react'
import { Key, Plus, Copy, CheckCheck, Loader2, Infinity, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, KeyDuration } from '@/types/database'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

interface GenerateKeyClientProps {
  initialCredits: number
  unlimitedCredits: boolean
  products: Product[]
  durations: KeyDuration[]
}

interface GeneratedKey {
  key_value: string
  product: string
  duration: string
  expires_at: string
  credits_cost: number
}

export function GenerateKeyClient({
  initialCredits,
  unlimitedCredits,
  products,
  durations,
}: GenerateKeyClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm' | 'result'>('form')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<KeyDuration | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null)
  const [credits, setCredits] = useState(initialCredits)
  const [copied, setCopied] = useState(false)
  const [recentKeys, setRecentKeys] = useState<GeneratedKey[]>([])

  const creditsCost = selectedProduct && selectedDuration
    ? Math.ceil(selectedProduct.credit_cost * selectedDuration.credit_multiplier)
    : 0

  const creditsAfter = unlimitedCredits ? null : credits - creditsCost
  const canGenerate = unlimitedCredits || credits >= creditsCost

  const openModal = () => { setModalOpen(true); setStep('form') }
  const closeModal = () => {
    setModalOpen(false)
    setStep('form')
    setSelectedProduct(null)
    setSelectedDuration(null)
  }

  const handleGenerate = async () => {
    if (!selectedProduct || !selectedDuration || loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          durationId: selectedDuration.id,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erro ao gerar key')
        return
      }

      const newKey: GeneratedKey = {
        key_value: data.key.key_value,
        product: selectedProduct.name,
        duration: selectedDuration.label,
        expires_at: data.key.expires_at,
        credits_cost: creditsCost,
      }

      setGeneratedKey(newKey)
      setRecentKeys((prev) => [newKey, ...prev.slice(0, 4)])
      if (!unlimitedCredits) setCredits((prev) => prev - creditsCost)
      setStep('result')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = async (keyValue: string) => {
    await navigator.clipboard.writeText(keyValue)
    setCopied(true)
    toast.success('Key copiada!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Gerar Key</h1>
          <p className="text-sm text-text-muted mt-0.5">Crie uma nova licença</p>
        </div>

        {/* Credits display */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background-card border border-border">
          {unlimitedCredits ? (
            <Infinity className="w-4 h-4 text-accent-blue" />
          ) : (
            <span className="text-sm font-mono font-bold text-accent-blue">
              {credits.toLocaleString('pt-BR')}
            </span>
          )}
          <span className="text-xs text-text-muted">créditos</span>
        </div>
      </div>

      {/* Generate button */}
      <div className="card-viibe p-8 text-center animate-stagger-1">
        {products.length === 0 ? (
          <EmptyState
            icon={Key}
            title="Nenhum produto disponível"
            description="O administrador ainda não cadastrou produtos."
          />
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto">
              <Key className="w-7 h-7 text-accent-blue" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Gerar nova key</h2>
              <p className="text-sm text-text-muted mt-1">Selecione o produto e a duração</p>
            </div>
            <button onClick={openModal} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" />
              Gerar Key
            </button>
          </div>
        )}
      </div>

      {/* Recent keys */}
      {recentKeys.length > 0 && (
        <div className="card-viibe p-5 animate-stagger-2">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Geradas nesta sessão</h2>
          <div className="space-y-2">
            {recentKeys.map((k, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-border hover:border-border-strong transition-all">
                <div>
                  <p className="text-xs font-mono font-semibold text-accent-blue">{k.key_value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{k.product} · {k.duration}</p>
                </div>
                <button
                  onClick={() => copyKey(k.key_value)}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
            <div className="bg-background-card border border-border rounded-2xl w-full max-w-md shadow-modal animate-scale-in">

              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-base font-bold text-text-primary">
                  {step === 'form' ? 'Configurar Key' : step === 'confirm' ? 'Confirmar Geração' : 'Key Gerada!'}
                </h2>
                <button onClick={closeModal} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* STEP: FORM */}
              {step === 'form' && (
                <div className="p-5 space-y-5">
                  {/* Product selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Produto</label>
                    <div className="space-y-2">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProduct(p)}
                          className={cn(
                            'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                            selectedProduct?.id === p.id
                              ? 'border-accent-blue bg-accent-blue/10 text-text-primary'
                              : 'border-border bg-background-secondary text-text-secondary hover:border-border-strong'
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            {p.description && <p className="text-xs text-text-muted mt-0.5">{p.description}</p>}
                          </div>
                          <span className="text-xs font-mono font-bold text-accent-blue whitespace-nowrap ml-3">
                            {p.credit_cost} cr/base
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Duração</label>
                    <div className="grid grid-cols-2 gap-2">
                      {durations.map((d) => {
                        const cost = selectedProduct
                          ? Math.ceil(selectedProduct.credit_cost * d.credit_multiplier)
                          : 0
                        return (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDuration(d)}
                            className={cn(
                              'flex flex-col items-center p-3 rounded-xl border transition-all',
                              selectedDuration?.id === d.id
                                ? 'border-accent-blue bg-accent-blue/10'
                                : 'border-border bg-background-secondary hover:border-border-strong'
                            )}
                          >
                            <span className={cn('text-sm font-semibold', selectedDuration?.id === d.id ? 'text-text-primary' : 'text-text-secondary')}>
                              {d.label}
                            </span>
                            {selectedProduct && (
                              <span className="text-xs font-mono text-accent-blue mt-1">{cost} cr</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Credit summary */}
                  {selectedProduct && selectedDuration && (
                    <div className="p-3 rounded-xl bg-background-secondary border border-border space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Custo</span>
                        <span className="font-mono font-bold text-text-primary">{creditsCost} créditos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Saldo atual</span>
                        <span className="font-mono font-bold text-text-primary">
                          {unlimitedCredits ? '∞' : credits.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {!unlimitedCredits && (
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="text-text-muted">Saldo após</span>
                          <span className={cn('font-mono font-bold', canGenerate ? 'text-status-success' : 'text-status-error')}>
                            {creditsAfter !== null && creditsAfter >= 0 ? creditsAfter.toLocaleString('pt-BR') : 'Insuficiente'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => selectedProduct && selectedDuration && canGenerate && setStep('confirm')}
                    disabled={!selectedProduct || !selectedDuration || !canGenerate}
                    className="btn-primary w-full"
                  >
                    {!canGenerate ? 'Créditos insuficientes' : 'Continuar'}
                    {canGenerate && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* STEP: CONFIRM */}
              {step === 'confirm' && selectedProduct && selectedDuration && (
                <div className="p-5 space-y-5">
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-background-secondary border border-border space-y-3">
                      {[
                        { label: 'Produto', value: selectedProduct.name },
                        { label: 'Duração', value: selectedDuration.label },
                        { label: 'Custo', value: `${creditsCost} créditos` },
                        {
                          label: 'Saldo após',
                          value: unlimitedCredits ? '∞' : `${creditsAfter?.toLocaleString('pt-BR')} créditos`,
                        },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span className="text-text-muted">{row.label}</span>
                          <span className="font-medium text-text-primary">{row.value}</span>
                        </div>
                      ))}
                    </div>
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
              {step === 'result' && generatedKey && (
                <div className="p-5 space-y-5">
                  <div className="text-center py-2">
                    <div className="w-12 h-12 rounded-xl bg-status-success-bg border border-status-success-border flex items-center justify-center mx-auto mb-3">
                      <CheckCheck className="w-6 h-6 text-status-success" />
                    </div>
                    <p className="text-sm text-text-muted">Key gerada com sucesso</p>
                  </div>

                  <div className="p-4 rounded-xl bg-background-secondary border border-accent-blue/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Sua key</span>
                      <button
                        onClick={() => copyKey(generatedKey.key_value)}
                        className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:text-accent-blue-glow transition-colors"
                      >
                        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <p className="font-mono text-sm font-bold text-text-primary break-all">
                      {generatedKey.key_value}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                      <div><span className="text-text-muted">Produto: </span><span className="text-text-secondary">{generatedKey.product}</span></div>
                      <div><span className="text-text-muted">Duração: </span><span className="text-text-secondary">{generatedKey.duration}</span></div>
                    </div>
                  </div>

                  <button onClick={closeModal} className="btn-secondary w-full">Fechar</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
