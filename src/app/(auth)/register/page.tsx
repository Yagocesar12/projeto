'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Check, X, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PasswordStrength {
  hasLength: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

function getStrength(p: PasswordStrength): 'fraca' | 'média' | 'forte' {
  const count = Object.values(p).filter(Boolean).length
  if (count <= 2) return 'fraca'
  if (count <= 4) return 'média'
  return 'forte'
}

function PasswordChecker({ password }: { password: string }) {
  if (!password) return null

  const s: PasswordStrength = {
    hasLength:  password.length >= 8,
    hasUpper:   /[A-Z]/.test(password),
    hasLower:   /[a-z]/.test(password),
    hasNumber:  /[0-9]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  }

  const strength = getStrength(s)
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
            {item.ok
              ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <X className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
            <span className={`text-xs ${item.ok ? 'text-zinc-300' : 'text-zinc-600'}`}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()

  const [form, setForm] = useState({ email: '', username: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [registered, setRegistered] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Username check debounced
  useEffect(() => {
    if (!form.username || form.username.length < 3) { setUsernameStatus('idle'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setUsernameStatus('idle'); return }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id').eq('username', form.username.toLowerCase()).single()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [form.username])

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const passwordStrength = (): PasswordStrength => ({
    hasLength:  form.password.length >= 8,
    hasUpper:   /[A-Z]/.test(form.password),
    hasLower:   /[a-z]/.test(form.password),
    hasNumber:  /[0-9]/.test(form.password),
    hasSpecial: /[^a-zA-Z0-9]/.test(form.password),
  })

  const isPasswordStrong = () => Object.values(passwordStrength()).every(Boolean)

  const isFormValid = () =>
    form.email.includes('@') &&
    form.username.length >= 3 &&
    usernameStatus === 'available' &&
    isPasswordStrong() &&
    form.password === form.confirmPassword

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !isFormValid()) return

    setLoading(true)
    setErrors({})

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: { username: form.username.toLowerCase() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (error.message.includes('already')) {
          setErrors({ email: 'Este e-mail já está em uso.' })
        } else {
          setErrors({ general: error.message })
        }
        return
      }

      setRegistered(true)
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendLoading || resendCooldown > 0) return
    setResendLoading(true)
    setResendSuccess(false)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: form.email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (!error) {
        setResendSuccess(true)
        setResendCooldown(60)
      }
    } catch {} finally {
      setResendLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
          <Mail className="w-7 h-7 text-blue-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Confirme seu e-mail</h1>
        <p className="text-sm text-zinc-500 mb-1">Enviamos um link de confirmação para:</p>
        <p className="text-sm text-zinc-300 font-medium mb-6">{form.email}</p>

        {resendSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400">E-mail de confirmação reenviado com sucesso.</p>
          </div>
        )}

        <button onClick={handleResend} disabled={resendLoading || resendCooldown > 0}
          className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2 mb-3">
          {resendLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Reenviando...</> :
           resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar e-mail'}
        </button>

        <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Criar sua conta</h1>
        <p className="text-sm text-zinc-500 mt-1">Crie sua conta para começar.</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">E-mail</label>
          <input type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Digite seu e-mail" autoComplete="email"
            className={`w-full h-11 px-3.5 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all ${errors.email ? 'border-red-500/50' : 'border-zinc-800'}`}
          />
          {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Usuário</label>
          <div className="relative">
            <input type="text" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
              placeholder="Escolha seu nome de usuário" autoComplete="username"
              className={`w-full h-11 px-3.5 pr-10 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all ${usernameStatus === 'taken' ? 'border-red-500/50' : usernameStatus === 'available' ? 'border-green-500/50' : 'border-zinc-800'}`}
            />
            {usernameStatus === 'checking' && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
            )}
            {usernameStatus === 'available' && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
            )}
            {usernameStatus === 'taken' && (
              <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
            )}
          </div>
          {usernameStatus === 'available' && <p className="text-xs text-green-400">✓ Usuário disponível</p>}
          {usernameStatus === 'taken' && <p className="text-xs text-red-400">✕ Este usuário já está em uso.</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Senha</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Crie uma senha segura" autoComplete="new-password"
              className="w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordChecker password={form.password} />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Confirmar senha</label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Digite sua senha novamente" autoComplete="new-password"
              className={`w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500/50' : form.confirmPassword && form.password === form.confirmPassword ? 'border-green-500/50' : 'border-zinc-800'}`}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-red-400">As senhas não coincidem.</p>
          )}
          {form.confirmPassword && form.password === form.confirmPassword && form.password && (
            <p className="text-xs text-green-400">✓ Senhas coincidem</p>
          )}
        </div>

        {errors.general && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{errors.general}</p>
          </div>
        )}

        <button type="submit" disabled={loading || !isFormValid()}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-1">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Criando conta...</> : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-600 mt-6">
        Já tem uma conta?{' '}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  )
}
