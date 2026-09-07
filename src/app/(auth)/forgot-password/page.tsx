'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (!email.trim()) { setError('Digite seu e-mail para continuar.'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Digite um e-mail válido.'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )
      if (resetError) { setError('Erro ao enviar e-mail. Tente novamente.'); return }
      setSent(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">E-mail enviado com sucesso</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Enviamos um link para redefinir sua senha. Verifique sua caixa de entrada e siga as instruções.
        </p>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Redefinir senha</h1>
        <p className="text-sm text-zinc-500 mt-1">Digite seu e-mail para receber um link de redefinição de senha.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Digite seu e-mail" autoComplete="email" autoFocus
            className={`w-full h-11 px-3.5 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all ${error ? 'border-red-500/50' : 'border-zinc-800'}`}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <button type="submit" disabled={loading}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : 'Enviar link de redefinição'}
        </button>
      </form>

      <div className="text-center mt-5">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}
