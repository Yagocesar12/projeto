'use client'

import { useState } from 'react'
import { DashboardSidebar } from './sidebar'
import { Topbar } from './topbar'
import type { Profile } from '@/types/database'

export function DashboardSidebarWrapper({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          profile={profile}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 page-enter">{children}</div>
        </main>
      </div>
    </div>
  )
}
