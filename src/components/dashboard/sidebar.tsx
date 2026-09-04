'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Key, Wallet, User, LogOut, X, Ghost } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Keys',     href: '/dashboard/keys',    icon: Key },
  { label: 'Carteira', href: '/dashboard/wallet',  icon: Wallet },
  { label: 'Perfil',   href: '/dashboard/profile', icon: User },
]

interface DashboardSidebarProps {
  profile: Profile
  mobileOpen: boolean
  onClose: () => void
}

function SidebarContent({ profile, onClose }: { profile: Profile; onClose?: () => void }) {
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
    <div className="flex flex-col h-full bg-background-secondary border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Ghost className="w-4 h-4 text-text-primary" />
          <span className="text-sm font-semibold text-text-primary tracking-tight">Ghost Panel</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest px-3 mb-2">Gestão</p>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} onClick={onClose}
            className={cn('sidebar-item', isActive(item.href, (item as any).exact) && 'active')}>
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Profile footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 p-2.5 rounded-md mb-1">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username}
              className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-border" />
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
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all w-full">
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )
}

export function DashboardSidebar({ profile, mobileOpen, onClose }: DashboardSidebarProps) {
  return (
    <>
      <aside className="hidden lg:flex flex-col w-52 shrink-0 h-screen sticky top-0">
        <SidebarContent profile={profile} />
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onClose} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-60 flex flex-col lg:hidden animate-slide-in-left">
            <SidebarContent profile={profile} onClose={onClose} />
          </aside>
        </>
      )}
    </>
  )
}
