'use client'

import { useState, useRef } from 'react'
import {
  User, Mail, Calendar, Clock, Key, Wallet,
  Camera, Eye, EyeOff, Loader2, CheckCircle2, Infinity
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatRelativeTime, getInitials, cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface KeyStats {
  total: number; active: number; pending: number; expired: number; blocked: number
}

interface ProfileClientProps {
  profile: Profile
  keyStats: KeyStats
}

export function ProfileClient({ profile: initialProfile, keyStats }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Máximo 2MB para avatar')
      return
    }

    setAvatarLoading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) { toast.error('Erro ao enviar avatar'); return }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id)

      if (updateError) { toast.error('Erro ao atualizar perfil'); return }

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }))
      toast.success('Avatar atualizado!')
    } catch { toast.error('Erro de conexão') }
    finally { setAvatarLoading(false) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwdLoading) return

    if (passwordForm.next.length < 8) { toast.error('Senha deve ter mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(passwordForm.next)) { toast.error('Inclua pelo menos uma letra maiúscula'); return }
    if (!/[0-9]/.test(passwordForm.next)) { toast.error('Inclua pelo menos um número'); return }
    if (passwordForm.next !== passwordForm.confirm) { toast.error('As senhas não coincidem'); return }

    setPwdLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next })
      if (error) { toast.error(error.message); return }
      toast.success('Senha alterada com sucesso!')
      setPasswordForm({ current: '', next: '', confirm: '' })
    } catch { toast.error('Erro de conexão') }
    finally { setPwdLoading(false) }
  }

  const infoRows = [
    { icon: User, label: 'Usuário', value: `@${profile.username}` },
    { icon: Mail, label: 'Email', value: profile.email },
    { icon: Calendar, label: 'Membro desde', value: formatDate(profile.created_at) },
    { icon: Clock, label: 'Último login', value: formatRelativeTime(profile.last_login, 'Nunca') },
    { icon: Clock, label: 'Última recarga', value: formatRelativeTime(profile.last_recharge, 'Nunca') },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Meu Perfil</h1>
        <p className="text-sm text-text-muted mt-0.5">Gerencie suas informações</p>
      </div>

      {/* Avatar + Info */}
      <div className="card-viibe p-6 animate-stagger-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-border" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-accent-blue">{getInitials(profile.username)}</span>
              </div>
            )}
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={avatarLoading}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {avatarLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
          </div>

          {/* Name + status */}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-text-primary">@{profile.username}</h2>
            <p className="text-sm text-text-muted">{profile.email}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                profile.status === 'active' ? 'badge-active' : 'badge-blocked'
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', profile.status === 'active' ? 'bg-status-success' : 'bg-status-error')} />
                {profile.status === 'active' ? 'Ativo' : 'Bloqueado'}
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20">
                {profile.unlimited_credits ? (
                  <><Infinity className="w-3 h-3 text-accent-blue" /><span className="text-xs font-bold text-accent-blue">∞ créditos</span></>
                ) : (
                  <span className="text-xs font-bold text-accent-blue">{profile.credits.toLocaleString('pt-BR')} créditos</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 divide-y divide-border">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 py-3">
              <div className="p-1.5 rounded-lg bg-background-tertiary">
                <row.icon className="w-3.5 h-3.5 text-text-muted" />
              </div>
              <span className="text-xs text-text-muted w-28 shrink-0">{row.label}</span>
              <span className="text-sm text-text-secondary">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Credits summary */}
      <div className="card-viibe p-6 animate-stagger-2">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-semibold text-text-primary">Créditos</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Saldo atual', value: profile.unlimited_credits ? '∞' : profile.credits.toLocaleString('pt-BR') },
            { label: 'Total recarregado', value: profile.total_recharged.toLocaleString('pt-BR') },
            { label: 'Total utilizado', value: profile.total_credits_used.toLocaleString('pt-BR') },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-background-secondary border border-border">
              <p className="text-xs text-text-muted mb-1">{item.label}</p>
              <p className="text-lg font-bold font-mono text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key stats */}
      <div className="card-viibe p-6 animate-stagger-3">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-semibold text-text-primary">Minhas Keys</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: keyStats.total, color: 'text-text-primary' },
            { label: 'Ativas', value: keyStats.active, color: 'text-status-success' },
            { label: 'Pendentes', value: keyStats.pending, color: 'text-status-info' },
            { label: 'Expiradas', value: keyStats.expired, color: 'text-text-muted' },
            { label: 'Bloqueadas', value: keyStats.blocked, color: 'text-status-error' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-background-secondary border border-border text-center">
              <p className={cn('text-xl font-bold font-mono', item.color)}>{item.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card-viibe p-6 animate-stagger-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Alterar Senha</h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Nova senha</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={passwordForm.next}
                onChange={e => setPasswordForm(p => ({ ...p, next: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="input-viibe pr-12"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-1">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Confirmar nova senha</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Repita a nova senha"
              className="input-viibe"
            />
          </div>

          <button type="submit" disabled={pwdLoading || !passwordForm.next || !passwordForm.confirm} className="btn-primary">
            {pwdLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
