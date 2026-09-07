import { AdminShellWrapper } from './shell-wrapper'
import type { Profile } from '@/types/database'

export function AdminShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <AdminShellWrapper profile={profile}>
      {children}
    </AdminShellWrapper>
  )
}
