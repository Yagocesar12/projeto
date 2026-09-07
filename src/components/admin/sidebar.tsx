'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Key, Wallet, Smartphone,
  Cpu, FileCode, Palette, Radio, Globe,
  ScrollText, Settings, LogOut, X, Ghost,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import type { Profile } from '@/types/database'

const sections = [
  {
    title: 'Painel',
    items: [
      { label: 'Visão Geral', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Revendedores', href: '/admin/resellers', icon: Users },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Keys',        href: '/admin/keys',     icon: Key },
      { label: 'Carteira',    href: '/admin/wallet',   icon: Wallet },
      { label: 'Dispositivos', href: '/admin/devices', icon: Smartphone },
    ],
  },
  {
    title: 'Aplicativo',
    items: [
      { label: 'Features',      href: '/admin/ipa/features',      icon: Cpu },
      { label: 'Arquivos',      href: '/admin/ipa/files',         icon: FileCode },
      { label: 'Mod Skins',     href: '/admin/ipa/skins',         icon: Palette },
      { label: 'Remote Config', href: '/admin/ipa/remote-config', icon: Radio },
      { label: 'Controles',     href: '/admin/ipa/controls',      icon: Globe },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Atividade',      href: '/admin/logs',     icon: ScrollText },
      { label: 'Configurações',  href: '/admin/settings', icon: Settings },
    ],
  },
]

interface AdminSidebarProps {
  profile: Profile
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

function SidebarContent({
  profile, onClose, collapsed, onToggleCollapse
}: {
  profile: Profile
  onClose?: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className={cn(
      'flex flex-col h-full bg-background-secondary border-r border-border transition-all duration-200',
      collapsed ? 'w-14' : 'w-52'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Ghost className="w-4 h-4 text-text-primary shrink-0" />
            <span className="text-sm font-semibold text-text-primary truncate">Ghost Admin</span>
          </div>
        )}
        {collapsed && <Ghost className="w-4 h-4 text-text-primary mx-auto" />}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all shrink-0',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {sections.map(section => (
          <div key={section.title}>
            {!collapsed && (
              <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest px-2 mb-1.5">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <div key={item.href} className="relative group">
                  <Link href={item.href} onClick={onClose}
                    className={cn(
                      'flex items-center rounded-md text-sm font-medium transition-all duration-100',
                      collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2',
                      isActive(item.href, (item as any).exact)
                        ? 'bg-accent-black text-white'
                        : 'text-text-secondary hover:bg-background-hover hover:text-text-primary'
                    )}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 rounded-md bg-accent-black text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                      {item.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile footer */}
      {!collapsed ? (
        <div className="border-t border-border p-2.5">
          <div className="flex items-center gap-2.5 p-2 rounded-md mb-1">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-border shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-background-tertiary border border-border flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-text-secondary">{getInitials(profile.username)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">@{profile.username}</p>
              <p className="text-2xs text-text-muted truncate">{profile.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all w-full">
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Sair
          </button>
        </div>
      ) : (
        <div className="border-t border-border p-2 flex flex-col items-center gap-2">
          <div className="relative group">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-7 h-7 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-background-tertiary border border-border flex items-center justify-center">
                <span className="text-xs font-semibold text-text-secondary">{getInitials(profile.username)}</span>
              </div>
            )}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 rounded-md bg-accent-black text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              @{profile.username}
            </div>
          </div>
          <button onClick={handleLogout}
            className="p-1.5 rounded-md text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all"
            title="Sair">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminSidebar({ profile, mobileOpen, onClose, collapsed, onToggleCollapse }: AdminSidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col h-screen sticky top-0 shrink-0">
        <SidebarContent profile={profile} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onClose} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 flex flex-col lg:hidden animate-slide-in-left">
            <SidebarContent profile={profile} onClose={onClose} collapsed={false} onToggleCollapse={onToggleCollapse} />
          </aside>
        </>
      )}
    </>
  )
}
