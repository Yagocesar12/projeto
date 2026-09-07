'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, CheckCircle2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function PasswordChecker({ password }: { password: string }) {
  if (!password) return null
  const s = {
    hasLength:  password.length >= 8,
    hasUpper:   /[A-Z]/.test(password),
    hasLower:   /[a-z]/.test(password),
    hasNumber:  /[0-9]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  }
  const count = Object.values(s).filter(Boolean).length
  const strength = count <= 2 ? 'fraca' : count <= 4 ? 'média' : 'forte'
  const strengthColor = strength === 'forte' ? 'text-green-400' : strength === 'média' ? 'text-yellow-400' : 'text-red-400'
  const barColor = strength === 'forte' ? 'bg-green-500' : strength === 'média' ? 'bg-yellow-500' : 'bg-red-500'
  const barWidth = strength === 'forte' ? 'w-full' : strength === 'média' ? 'w-2/3' : 'w-1/3'
  const items = [
    { ok: s.hasLength,  label: 'Pelo menos 8 caracteres' },
    { ok: s.hasUpper,   label: 'Uma letra maiúscula' },
    { ok: s.hasLower,   label: 'Uma letra minúscula' },
    { ok: s.hasNumber,  label: 'Um número' },
    { ok: s.hasSpecial, label: 'Um caractere especial' },
  ]
  return (
    <div className="mt-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Força da senha:</span>
        <span className={`text-xs font-semibold capitalize ${strengthColor}`}>{strength}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor} ${barWidth}`} />
      </div>
      <div className="space-y-1.5 pt-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            {item.ok ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
            <span className={`text-xs ${item.ok ? 'text-zinc-300' : 'text-zinc-600'}`}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
  }, [])

  const isStrong = () => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) &&
           /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)
  }

  const canSubmit = isStrong() && password === confirm && sessionReady

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) { setError('Erro ao redefinir senha. Tente novamente.'); return }
      setDone(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Senha redefinida com sucesso!</h1>
        <p className="text-sm text-zinc-500 mb-6">Sua senha foi alterada. Você já pode entrar com a nova senha.</p>
        <Link href="/login"
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center">
          Entrar novamente
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Criar nova senha</h1>
        <p className="text-sm text-zinc-500 mt-1">Escolha uma senha forte para sua conta.</p>
      </div>

      {!sessionReady && (
        <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-400">Aguardando validação do link...</p>
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nova senha</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite sua nova senha" autoComplete="new-password"
              className="w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordChecker password={password} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Confirmar senha</label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Digite sua senha novamente" autoComplete="new-password"
              className={`w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all ${confirm && password !== confirm ? 'border-red-500/50' : confirm && password === confirm ? 'border-green-500/50' : 'border-zinc-800'}`}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirm && password !== confirm && <p className="text-xs text-red-400">As senhas não coincidem.</p>}
          {confirm && password === confirm && password && <p className="text-xs text-green-400">✓ Senhas coincidem</p>}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading || !canSubmit}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Redefinindo...</> : 'Redefinir senha'}
        </button>
      </form>
    </div>
  )
}
