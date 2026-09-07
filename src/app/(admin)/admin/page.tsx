'use client'

import { useState, useEffect } from 'react'
import { Key, Clock, XCircle, ShieldX } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { cn } from '@/lib/utils'

const PERIODS = ['7 dias', '30 dias', '90 dias']

interface Stats {
  keys_active: number
  keys_pending: number
  keys_expired: number
  keys_blocked: number
}

interface ChartPoint { date: string; keys: number; credits: number }
interface TopReseller { username: string; avatar_url: string | null; credits_used: number; rank: number }

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ keys_active: 0, keys_pending: 0, keys_expired: 0, keys_blocked: 0 })
  const [period, setPeriod] = useState('7 dias')
  const [chart, setChart] = useState<ChartPoint[]>([])
  const [top, setTop] = useState<TopReseller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats || {})
        setTop(d.top_resellers || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const days = period === '7 dias' ? 7 : period === '30 dias' ? 30 : 90
    fetch(`/api/admin/dashboard/chart?days=${days}`)
      .then(r => r.json())
      .then(d => setChart(d.chart || []))
      .catch(() => {})
  }, [period])

  // Simple SVG chart
  const maxKeys = Math.max(...chart.map(p => p.keys), 1)
  const chartW = 600
  const chartH = 140
  const pad = { top: 8, right: 8, bottom: 24, left: 28 }
  const innerW = chartW - pad.left - pad.right
  const innerH = chartH - pad.top - pad.bottom

  const points = chart.map((p, i) => ({
    x: pad.left + (i / Math.max(chart.length - 1, 1)) * innerW,
    y: pad.top + innerH - (p.keys / maxKeys) * innerH,
    ...p,
  }))

  const pathD = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : ''

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`
    : ''

  const getInitials = (u: string) => u.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Visão Geral</h2>
        <p className="text-xs text-text-muted mt-0.5">Acompanhe os principais indicadores da plataforma.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Keys ativas"    value={loading ? '—' : stats.keys_active}  icon={Key}     delay={0} />
        <MetricCard title="Pendentes"      value={loading ? '—' : stats.keys_pending} icon={Clock}   delay={1} />
        <MetricCard title="Expiradas"      value={loading ? '—' : stats.keys_expired} icon={XCircle} delay={2} />
        <MetricCard title="Bloqueadas"     value={loading ? '—' : stats.keys_blocked} icon={ShieldX} delay={3} />
      </div>

      {/* Chart + Top 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-stagger-4">
        {/* Chart */}
        <div className="card-ghost p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-text-primary">Keys geradas</p>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn('px-2.5 py-1 text-xs rounded font-medium border transition-all',
                    period === p
                      ? 'bg-accent-black text-white border-accent-black'
                      : 'bg-white text-text-secondary border-border hover:border-border-strong')}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {chart.length === 0 ? (
            <div className="h-36 flex items-center justify-center">
              <p className="text-xs text-text-muted">Sem dados no período</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
              <defs>
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A1A1A" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#1A1A1A" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <line key={t}
                  x1={pad.left} y1={pad.top + t * innerH}
                  x2={pad.left + innerW} y2={pad.top + t * innerH}
                  stroke="#E7E7E4" strokeWidth="1" />
              ))}
              {/* Y labels */}
              {[0, 0.5, 1].map(t => (
                <text key={t} x={pad.left - 4} y={pad.top + t * innerH + 4}
                  textAnchor="end" fontSize="9" fill="#98989D">
                  {Math.round(maxKeys * (1 - t))}
                </text>
              ))}
              {/* Area */}
              {areaD && <path d={areaD} fill="url(#area-grad)" />}
              {/* Line */}
              {pathD && <path d={pathD} fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
              {/* X labels */}
              {points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map((p, i) => (
                <text key={i} x={p.x} y={chartH - 4} textAnchor="middle" fontSize="9" fill="#98989D">
                  {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </text>
              ))}
            </svg>
          )}
        </div>

        {/* Top 10 resellers */}
        <div className="card-ghost p-5">
          <p className="text-sm font-medium text-text-primary mb-4">Top Revendedores</p>
          {top.length === 0 ? (
            <p className="text-xs text-text-muted">Sem dados</p>
          ) : (
            <div className="space-y-0">
              {top.slice(0, 10).map((r, i) => (
                <div key={r.username} className={cn(
                  'flex items-center gap-3 py-2.5',
                  i < top.length - 1 && 'border-b border-border'
                )}>
                  <span className="text-xs font-mono text-text-muted w-5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt={r.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-border shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-background-tertiary border border-border flex items-center justify-center shrink-0">
                      <span className="text-2xs font-semibold text-text-muted">{getInitials(r.username)}</span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-text-primary flex-1 min-w-0 truncate">
                    @{r.username}
                  </span>
                  <span className="text-xs font-mono text-text-secondary shrink-0">
                    {r.credits_used.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
