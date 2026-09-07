'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ERROR_MAP: Record<string, string> = {
  invalid_credentials: 'E-mail, usuário ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_banned: 'Sua conta foi bloqueada. Entre em contato com o suporte.',
  too_many_requests: 'Muitas tentativas. Aguarde alguns minutos.',
  network_error: 'Erro de conexão. Tente novamente.',
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDiscord, setLoadingDiscord] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (!identifier.trim() || !password) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      let email = identifier.trim().toLowerCase()
      if (!email.includes('@')) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('username', email).single()
        if (!profile) { setError(ERROR_MAP.invalid_credentials); return }
        email = profile.email
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        const msg = authError.message.toLowerCase()
        if (msg.includes('invalid') || msg.includes('credentials')) setError(ERROR_MAP.invalid_credentials)
        else if (msg.includes('confirm')) setError(ERROR_MAP.email_not_confirmed)
        else if (msg.includes('banned')) setError(ERROR_MAP.user_banned)
        else if (msg.includes('too many')) setError(ERROR_MAP.too_many_requests)
        else setError(ERROR_MAP.invalid_credentials)
        return
      }
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', data.user.id).single()
        if (profile?.status === 'blocked') { await supabase.auth.signOut(); router.push('/blocked'); return }
        router.push(profile?.role === 'admin' ? '/admin' : redirect.startsWith('/admin') ? '/dashboard' : redirect)
        router.refresh()
      }
    } catch { setError(ERROR_MAP.network_error) }
    finally { setLoading(false) }
  }

  const handleDiscord = async () => {
    if (loadingDiscord) return
    setLoadingDiscord(true)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: `${window.location.origin}/auth/callback` } })
    } catch { setError('Erro ao conectar com Discord.'); setLoadingDiscord(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Entrar</h1>
        <p className="text-sm text-text-muted mt-1">Acesse sua conta para continuar.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">E-mail ou usuário</label>
          <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
            placeholder="Digite seu e-mail ou usuário" autoComplete="username" autoFocus
            className="input-ghost" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">Senha</label>
            <Link href="/forgot-password" className="text-xs text-text-muted hover:text-text-primary transition-colors">
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Digite sua senha" autoComplete="current-password"
              className="input-ghost pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-status-error-bg border border-status-error-border">
            <p className="text-xs text-status-error">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-black w-full h-9">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Entrando...</> : 'Entrar'}
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-text-muted bg-background">ou continuar com</span>
        </div>
      </div>

      <button onClick={handleDiscord} disabled={loadingDiscord}
        className="btn-ghost w-full h-9 flex items-center justify-center gap-2">
        {loadingDiscord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DiscordIcon />}
        {loadingDiscord ? 'Conectando...' : 'Discord'}
      </button>

      <p className="text-center text-xs text-text-muted mt-6">
        Não tem uma conta?{' '}
        <Link href="/register" className="text-text-primary font-medium hover:underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-80 rounded-lg bg-background-card border border-border animate-pulse" />}>
      <LoginForm />
    </Suspense>
  )
}
