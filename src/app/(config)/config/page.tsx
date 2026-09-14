'use client'

import { useState, useEffect, useCallback } from 'react'

interface Server {
  id: string
  name: string
  region?: string
  ms: number
  ports?: Record<string, number>
}

interface Features {
  [key: string]: boolean | string
}

type Tab = 'setup' | 'features' | 'logout'

const FEATURE_CONFIG = {
  combat: {
    label: 'Combat',
    icon: '🎯',
    features: [
      { key: 'aimbot', name: 'Aimbot Legit' },
      { key: 'icewall', name: 'Icewall Inverted' },
    ],
  },
  vision: {
    label: 'Vision',
    icon: '👁️',
    features: [
      { key: 'moco', name: 'ESP Moco' },
    ],
    extras: [
      {
        key: 'marker',
        name: 'Marker Type',
        type: 'select' as const,
        options: [
          { value: '3', label: 'Shirou' },
          { value: '1', label: 'Moco' },
          { value: '2', label: 'Clu' },
          { value: '5', label: 'Iris' },
          { value: '7', label: 'Dreki' },
          { value: '9', label: 'Phantom' },
          { value: '11', label: 'Ice Wall' },
          { value: '14', label: 'Dreamland' },
        ],
      },
    ],
  },
  revive: {
    label: 'Revive',
    icon: '❤️',
    features: [
      { key: 'auto_revive', name: 'Auto Revive', desc: 'Automatically revive nearby teammates', group: 'revive' },
      { key: 'fast_revive', name: 'Fast Revive', desc: 'Speed up manual rescue when holding button', group: 'revive' },
    ],
  },
}

export default function ConfigPage() {
  const [keyValue, setKeyValue] = useState('')
  const [validated, setValidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('setup')
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [showServerList, setShowServerList] = useState(false)
  const [features, setFeatures] = useState<Features>({})
  const [deepLink, setDeepLink] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [deviceLinked, setDeviceLinked] = useState(false)

  // Check URL for key param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const k = params.get('key')
    const t = params.get('tab') as Tab
    if (k) {
      setKeyValue(k)
      validateKey(k)
    }
    if (t) setTab(t)
  }, [])

  const validateKey = useCallback(async (key: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/proxy/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ip: 'web-panel' }),
      })
      const data = await res.json()
      if (data.allowed) {
        setValidated(true)
        setFeatures(data.features || {})
        setExpiresAt(data.expires_at || '')
        window.history.replaceState(null, '', `/config?key=${key}&tab=${tab}`)
        loadServers()
      } else {
        setError(data.error || 'Key inválida')
      }
    } catch {
      setError('Erro de conexão')
    }
    setLoading(false)
  }, [tab])

  const loadServers = async () => {
    try {
      const res = await fetch('/api/proxy/ping')
      const data = await res.json()
      setServers(data)
      if (data.length > 0) setSelectedServer(data[0])
    } catch { /* ignore */ }
  }

  const generateConfig = async () => {
    if (!selectedServer) return
    try {
      const res = await fetch('/api/proxy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyValue,
          server_id: selectedServer.id,
          port: 10025,
        }),
      })
      const data = await res.json()
      if (data.deep_link) {
        setDeepLink(data.deep_link)
        setDeviceLinked(true)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (validated && selectedServer) generateConfig()
  }, [validated, selectedServer])

  const toggleFeature = async (featureKey: string, group?: string) => {
    const current = !!features[featureKey]
    const newFeatures = { ...features }

    if (group && !current) {
      Object.keys(newFeatures).forEach(k => {
        const cfg = Object.values(FEATURE_CONFIG).flatMap(c => c.features)
        const feat = cfg.find(f => f.key === k)
        if (feat && 'group' in feat && feat.group === group && k !== featureKey) {
          newFeatures[k] = false
        }
      })
    }

    newFeatures[featureKey] = !current
    setFeatures(newFeatures)

    const fd = new FormData()
    fd.append('key', keyValue)
    fd.append(featureKey, !current ? '1' : '0')
    if (group && !current) {
      Object.keys(newFeatures).forEach(k => {
        if (k !== featureKey && !newFeatures[k]) {
          const cfg = Object.values(FEATURE_CONFIG).flatMap(c => c.features)
          const feat = cfg.find(f => f.key === k)
          if (feat && 'group' in feat && feat.group === group) {
            fd.append(k, '0')
          }
        }
      })
    }
    fetch('/api/proxy/features', { method: 'POST', body: fd })
  }

  const updateSelect = async (featureKey: string, value: string) => {
    setFeatures(prev => ({ ...prev, [featureKey]: value }))
    const fd = new FormData()
    fd.append('key', keyValue)
    fd.append(featureKey, value)
    fetch('/api/proxy/features', { method: 'POST', body: fd })
  }

  const timeRemaining = () => {
    if (!expiresAt) return '—'
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 24) return `${Math.floor(h / 24)}d`
    return `${h}h${m > 0 ? ` ${m}m` : ''}`
  }

  // Key entry screen
  if (!validated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-white/10 rounded-2xl flex items-center justify-center text-2xl">👻</div>
            <h1 className="text-xl font-semibold">GHOST Panel</h1>
            <p className="text-sm text-white/50">Enter your license key to continue</p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && validateKey(keyValue)}
              placeholder="Enter your key"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 text-center tracking-widest"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button
              onClick={() => validateKey(keyValue)}
              disabled={loading || !keyValue}
              className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition disabled:opacity-40"
            >
              {loading ? 'Validating...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-sm">👻</div>
        <span className="font-semibold text-sm">GHOST</span>
        <span className="ml-auto text-xs bg-white/10 px-2.5 py-1 rounded-full">{timeRemaining()}</span>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-20 max-w-lg mx-auto w-full">
        {tab === 'setup' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Install Configuration</h2>
              <p className="text-sm text-white/50 mt-1">Connect to the proxy server using HappProxy</p>
            </div>

            {/* Server selector */}
            <div className="relative">
              <button
                onClick={() => setShowServerList(!showServerList)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition"
              >
                <span className="text-white/60">🌐</span>
                <span className="flex-1 text-left text-sm">
                  {selectedServer?.name || 'Finding best server...'}
                </span>
                {selectedServer && (
                  <span className="text-xs text-green-400">{selectedServer.ms}ms</span>
                )}
                <span className="text-white/40">▼</span>
              </button>
              {showServerList && (
                <div className="absolute z-10 mt-1 w-full bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  {servers.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedServer(s); setShowServerList(false) }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition ${s.id === selectedServer?.id ? 'bg-white/10' : ''}`}
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-white/40">{s.ms}ms</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Device card */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-white/40">📱</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{deviceLinked ? 'Device Ready' : 'No Device Linked'}</p>
                <p className="text-xs text-white/40">{deviceLinked ? 'Connected via HappProxy' : 'Connect with HappProxy to link'}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${deviceLinked ? 'bg-green-500' : 'bg-red-500/60'}`} />
            </div>

            {/* Install button */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <img
                  src="https://play-lh.googleusercontent.com/dz5lnFqgq_K3ts3q2v47ynpTGwCPv7fceisG-_FUqatl19Vgejy-KFGlKwXfxETyAZrutA_wBYaQ-KNINodVqQ=w240"
                  alt="HappProxy"
                  className="w-12 h-12 rounded-xl"
                />
                <div>
                  <p className="text-sm font-medium">HappProxy</p>
                  <p className="text-xs text-white/40">Required to connect</p>
                </div>
              </div>

              <a
                href={deepLink || '#'}
                className={`block w-full py-3 text-center font-medium rounded-xl transition text-sm ${deepLink ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 text-white/30 pointer-events-none'}`}
              >
                Install Config
              </a>
              <p className="text-xs text-white/40 text-center">Opens HappProxy and imports the configuration</p>
            </div>

            {/* Store links */}
            <div className="space-y-2">
              <p className="text-xs text-white/40">Don&apos;t have HappProxy?</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://play.google.com/store/apps/details?id=com.happproxy"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 transition"
                >
                  ▶ Google Play
                </a>
                <a
                  href="https://apps.apple.com/us/app/happ-proxy-utility/id6504287215"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 transition"
                >
                  🍎 App Store
                </a>
              </div>
            </div>
          </div>
        )}

        {tab === 'features' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Features</h2>
              <p className="text-sm text-white/50 mt-1">Manage active features for your session</p>
            </div>

            {Object.entries(FEATURE_CONFIG).map(([catKey, cat]) => (
              <div key={catKey} className="space-y-1">
                <div className="flex items-center gap-2 px-1 py-2">
                  <span>{cat.icon}</span>
                  <span className="text-sm font-medium text-white/70">{cat.label}</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
                  {cat.features.map(feat => (
                    <div key={feat.key} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm">{feat.name}</p>
                        {'desc' in feat && feat.desc && (
                          <p className="text-xs text-white/40 mt-0.5">{feat.desc}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleFeature(feat.key, 'group' in feat ? feat.group : undefined)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${features[feat.key] ? 'bg-green-500' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${features[feat.key] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}

                  {'extras' in cat && cat.extras?.map(extra => (
                    <div key={extra.key} className="px-4 py-3">
                      <p className="text-xs text-white/50 mb-2">{extra.name}</p>
                      <select
                        value={String(features[extra.key] || extra.options[0].value)}
                        onChange={e => updateSelect(extra.key, e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 appearance-none"
                      >
                        {extra.options.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'logout' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <p className="text-white/50 text-sm">Are you sure you want to disconnect?</p>
            <button
              onClick={() => {
                setValidated(false)
                setKeyValue('')
                setFeatures({})
                window.history.replaceState(null, '', '/config')
              }}
              className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm">
        {(['setup', 'features', 'logout'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              window.history.replaceState(null, '', `/config?key=${keyValue}&tab=${t}`)
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition ${tab === t ? 'text-white' : 'text-white/30'}`}
          >
            <span className="text-lg">
              {t === 'setup' ? '⬇️' : t === 'features' ? '⚙️' : '🚪'}
            </span>
            <span className="capitalize">{t}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
