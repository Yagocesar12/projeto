'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Palette, Plus, Search, MoreHorizontal, Eye,
  ToggleLeft, ToggleRight, Trash2, X, Loader2, Upload
} from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ModSkin } from '@/types/database'

type ModalType = 'add' | 'view' | 'delete'
interface ActiveModal { type: ModalType; skin?: ModSkin }

export default function ModSkinsPage() {
  const [skins, setSkins] = useState<ModSkin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState<ActiveModal | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const previewRef = useRef<HTMLInputElement>(null)

  // New skin form
  const [form, setForm] = useState({ name: '', filename: '' })
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)

  const fetchSkins = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ ...(statusFilter && { status: statusFilter }), ...(search && { search }) })
      const res = await fetch(`/api/admin/skins?${params}`)
      const data = await res.json()
      setSkins(data.data || [])
    } catch { toast.error('Erro ao carregar skins') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSkins() }, [search, statusFilter])

  const handlePreviewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Apenas JPG/PNG permitido')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Máximo 2MB para preview')
      return
    }

    setPreviewFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleAddSkin = async () => {
    if (!form.name.trim() || !form.filename.trim()) {
      toast.error('Nome e filename são obrigatórios')
      return
    }

    setActionLoading(true)
    try {
      let previewUrl: string | null = null

      // Upload preview to Supabase Storage if provided
      if (previewFile) {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const path = `previews/${form.filename}_${Date.now()}.${previewFile.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('skins')
          .upload(path, previewFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('skins').getPublicUrl(path)
          previewUrl = urlData.publicUrl
        }
      }

      const res = await fetch('/api/admin/skins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, filename: form.filename, preview_url: previewUrl }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao adicionar'); return }

      toast.success('Skin adicionada!')
      setModal(null)
      setForm({ name: '', filename: '' })
      setPreviewFile(null)
      setPreviewDataUrl(null)
      fetchSkins()
    } catch { toast.error('Erro de conexão') }
    finally { setActionLoading(false) }
  }

  const handleToggle = async (skin: ModSkin) => {
    try {
      const res = await fetch(`/api/admin/skins/${skin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: skin.status === 'active' ? 'inactive' : 'active' }),
      })
      if (!res.ok) { toast.error('Erro ao atualizar'); return }
      toast.success(`Skin ${skin.status === 'active' ? 'desativada' : 'ativada'}`)
      fetchSkins()
    } catch { toast.error('Erro de conexão') }
  }

  const handleDelete = async (skin: ModSkin) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/skins/${skin.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro'); return }
      toast.success('Skin excluída')
      setModal(null)
      fetchSkins()
    } catch { toast.error('Erro de conexão') }
    finally { setActionLoading(false) }
  }

  return (
    <div className="space-y-6" onClick={() => setOpenMenuId(null)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
            <Palette className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Mod Skin Catalog</h1>
            <p className="text-sm text-text-muted">{skins.length} skin{skins.length !== 1 ? 's' : ''} cadastrada{skins.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" />
          Adicionar Skin
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar skin..." className="input-viibe pl-10" />
        </div>
        {['', 'active', 'inactive'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              statusFilter === s ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary hover:bg-background-hover border border-border')}>
            {s === '' ? 'Todas' : s === 'active' ? 'Ativas' : 'Inativas'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : skins.length === 0 ? (
        <EmptyState icon={Palette} title="Nenhuma skin encontrada"
          description="Adicione a primeira skin ao catálogo."
          action={<button onClick={() => setModal({ type: 'add' })} className="btn-primary text-sm">Adicionar Skin</button>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {skins.map(skin => (
            <div key={skin.id} className="card-viibe overflow-hidden group">
              {/* Preview */}
              <div className="aspect-square bg-background-tertiary relative overflow-hidden">
                {skin.preview_url ? (
                  <img src={skin.preview_url} alt={skin.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Palette className="w-8 h-8 text-text-muted opacity-30" />
                  </div>
                )}
                {/* Status overlay */}
                {skin.status === 'inactive' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-xs font-medium text-text-muted">Inativa</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-semibold text-text-primary truncate">{skin.name}</p>
                <p className="text-xs text-text-muted font-mono truncate mt-0.5">{skin.filename}</p>

                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={skin.status} />
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ type: 'view', skin })}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-all">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggle(skin)}
                      className={cn('p-1.5 rounded-lg transition-all',
                        skin.status === 'active'
                          ? 'text-status-success hover:bg-status-success-bg'
                          : 'text-text-muted hover:text-status-success hover:bg-status-success-bg')}>
                      {skin.status === 'active' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setModal({ type: 'delete', skin })}
                      className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error-bg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD MODAL */}
      {modal?.type === 'add' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-md shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Adicionar Skin</h2>
              <button onClick={() => { setModal(null); setForm({ name: '', filename: '' }); setPreviewDataUrl(null); setPreviewFile(null) }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Preview upload */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Preview</label>
                <div
                  onClick={() => previewRef.current?.click()}
                  className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-accent-blue/50 cursor-pointer transition-colors overflow-hidden bg-background-secondary"
                >
                  {previewDataUrl ? (
                    <img src={previewDataUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Upload className="w-6 h-6 text-text-muted" />
                      <p className="text-xs text-text-muted">JPG ou PNG, máx. 2MB</p>
                    </div>
                  )}
                </div>
                <input ref={previewRef} type="file" accept="image/jpeg,image/png" onChange={handlePreviewChange} className="hidden" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Nome de exibição *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Dragon Blade" className="input-viibe" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Filename *</label>
                <input type="text" value={form.filename} onChange={e => setForm(p => ({ ...p, filename: e.target.value.replace(/\s/g, '_') }))}
                  placeholder="Ex: dragon_blade" className="input-viibe font-mono" />
                <p className="text-xs text-text-muted">Apenas letras, números, _ e -</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleAddSkin} disabled={actionLoading} className="btn-primary flex-1">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {modal?.type === 'delete' && modal.skin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-sm shadow-modal animate-scale-in">
            <div className="p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Excluir Skin</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-text-secondary">
                Excluir <strong className="text-text-primary">{modal.skin.name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => modal.skin && handleDelete(modal.skin)} disabled={actionLoading} className="btn-danger flex-1">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
