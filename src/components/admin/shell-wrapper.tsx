'use client'

import { useState, useEffect } from 'react'
import { AdminSidebar } from './sidebar'
import { Menu, Bell, ChevronDown, Settings, User, LogOut } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Visão Geral',
  '/admin/resellers': 'Revendedores',
  '/admin/keys': 'Keys',
  '/admin/wallet': 'Carteira',
  '/admin/devices': 'Dispositivos',
  '/admin/ipa/features': 'Features',
  '/admin/ipa/files': 'Arquivos',
  '/admin/ipa/skins': 'Mod Skins',
  '/admin/ipa/remote-config': 'Remote Config',
  '/admin/ipa/controls': 'Controles',
  '/admin/logs': 'Atividade',
  '/admin/settings': 'Configurações',
  '/admin/settings/system': 'Configurações',
}

export function AdminShellWrapper({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const title = PAGE_TITLES[pathname] || 'Admin'

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-5 bg-background-secondary/90 backdrop-blur-md border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all lg:hidden">
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-text-primary">{title}</span>
          </div>

          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all">
              <Bell className="w-4 h-4" />
            </button>

            {/* Profile popover */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md hover:bg-background-hover transition-all"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-background-tertiary border border-border flex items-center justify-center">
                    <span className="text-2xs font-semibold text-text-secondary">{getInitials(profile.username)}</span>
                  </div>
                )}
                <span className="text-xs text-text-secondary hidden sm:block">@{profile.username}</span>
                <ChevronDown className="w-3 h-3 text-text-muted" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white border border-border rounded-lg py-1 shadow-dropdown animate-scale-in">
                    <div className="px-3 py-2.5 border-b border-border mb-1">
                      <div className="flex items-center gap-2.5">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.username} className="w-8 h-8 rounded-full object-cover ring-1 ring-border" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-background-tertiary border border-border flex items-center justify-center">
                            <span className="text-xs font-semibold text-text-secondary">{getInitials(profile.username)}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">@{profile.username}</p>
                          <p className="text-2xs text-text-muted truncate">{profile.email}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { router.push('/admin/settings'); setProfileOpen(false) }}
                      className="dropdown-item w-full">
                      <Settings className="w-3.5 h-3.5" />
                      Configurações
                    </button>
                    <div className="border-t border-border my-1" />
                    <button onClick={handleLogout} className="dropdown-item danger w-full">
                      <LogOut className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 page-enter">{children}</div>
        </main>
      </div>
    </div>
  )
}
