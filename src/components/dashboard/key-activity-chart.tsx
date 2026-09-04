'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '../ui/skeleton'

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

interface ChartPoint {
  date: string
  ativas: number
  geradas: number
}

interface KeyActivityChartProps {
  userId?: string  // undefined = admin (sees all)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card-viibe px-3 py-2.5 shadow-modal text-xs space-y-1">
      <p className="text-text-muted mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-mono font-bold text-text-primary">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function KeyActivityChart({ userId }: KeyActivityChartProps) {
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const supabase = createClient()
      const since = subDays(new Date(), period).toISOString()

      let query = supabase
        .from('keys')
        .select('created_at, status')
        .gte('created_at', since)
        .order('created_at')

      if (userId) query = query.eq('created_by', userId)

      const { data: keys } = await query

      const days = eachDayOfInterval({
        start: subDays(new Date(), period - 1),
        end: new Date(),
      })

      const chart: ChartPoint[] = days.map((day) => {
        const dayStr = startOfDay(day).toISOString()
        const nextStr = startOfDay(subDays(day, -1)).toISOString()

        const geradas = keys?.filter(
          (k) => k.created_at >= dayStr && k.created_at < nextStr
        ).length || 0

        const ativas = keys?.filter(
          (k) => k.created_at <= nextStr && k.status === 'active'
        ).length || 0

        return {
          date: format(day, period <= 15 ? 'dd/MM' : 'dd/MM', { locale: ptBR }),
          geradas,
          ativas,
        }
      })

      setData(chart)
      setLoading(false)
    }

    fetch()
  }, [userId, period])

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-1 mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p.days
                ? 'bg-accent-blue text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-background-hover'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-52 w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradGeradas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D5AF5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2D5AF5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAtivas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A2433" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
              interval={period <= 15 ? 1 : period <= 30 ? 4 : 11} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="geradas" name="Geradas" stroke="#2D5AF5"
              strokeWidth={2} fill="url(#gradGeradas)" dot={false} activeDot={{ r: 4, fill: '#2D5AF5' }} />
            <Area type="monotone" dataKey="ativas" name="Ativas" stroke="#10B981"
              strokeWidth={2} fill="url(#gradAtivas)" dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
