'use client'

import { usePathname } from 'next/navigation'
import { Menu, Bell } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/keys': 'Keys',
  '/dashboard/wallet': 'Carteira',
  '/dashboard/profile': 'Perfil',
}

interface TopbarProps {
  profile: Profile
  onMenuClick: () => void
  title?: string
}

export function Topbar({ profile, onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] || 'Dashboard'

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-background-secondary/90 backdrop-blur-md border-b border-border animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all lg:hidden">
          <Menu className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-text-primary">{title}</span>
      </div>

      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-all">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-2">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-background-tertiary border border-border flex items-center justify-center">
              <span className="text-2xs font-semibold text-text-secondary">{getInitials(profile.username)}</span>
            </div>
          )}
          <span className="text-xs text-text-secondary hidden sm:block">@{profile.username}</span>
        </div>
      </div>
    </header>
  )
}
