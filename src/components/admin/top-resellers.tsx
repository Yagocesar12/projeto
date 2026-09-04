'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Users, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface ResellerRank {
  id: string
  username: string
  avatar_url: string | null
  keys_count: number
  total_credits_used: number
  total_recharged: number
}

export function AdminTopResellers() {
  const [data, setData] = useState<ResellerRank[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_credits_used, total_recharged')
        .eq('role', 'reseller')
        .order('total_credits_used', { ascending: false })
        .limit(10)

      if (!profiles) { setLoading(false); return }

      // Get key counts
      const withKeys = await Promise.all(
        profiles.map(async (p) => {
          const { count } = await supabase
            .from('keys')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', p.id)
          return { ...p, keys_count: count || 0 }
        })
      )

      setData(withKeys.sort((a, b) => b.keys_count - a.keys_count))
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-6 h-4" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )

  if (data.length === 0) return <EmptyState icon={Users} title="Nenhum revendedor ainda" />

  const medalColors = ['#F59E0B', '#94A3B8', '#CD7C41']

  return (
    <div className="space-y-2">
      {data.map((r, i) => (
        <div key={r.id}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-background-hover transition-all">
          {/* Rank */}
          <div className="w-7 shrink-0 text-center">
            {i < 3 ? (
              <Trophy className="w-4 h-4 mx-auto" style={{ color: medalColors[i] }} />
            ) : (
              <span className="text-xs text-text-muted font-mono font-bold">{i + 1}</span>
            )}
          </div>

          {/* Avatar */}
          {r.avatar_url ? (
            <img src={r.avatar_url} alt={r.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-accent-blue">{getInitials(r.username)}</span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">@{r.username}</p>
            <p className="text-xs text-text-muted">{r.total_credits_used.toLocaleString('pt-BR')} cr usados</p>
          </div>

          {/* Keys count */}
          <div className="text-right shrink-0">
            <p className="text-sm font-mono font-bold text-text-primary">{r.keys_count}</p>
            <p className="text-xs text-text-muted">keys</p>
          </div>
        </div>
      ))}
    </div>
  )
}
