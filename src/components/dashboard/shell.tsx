import { DashboardSidebarWrapper } from './sidebar-wrapper'
import type { Profile } from '@/types/database'

export function DashboardShell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  return (
    <DashboardSidebarWrapper profile={profile}>
      {children}
    </DashboardSidebarWrapper>
  )
}
