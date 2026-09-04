'use client'

import { useState, useEffect, useRef } from 'react'
import { FileCode, Upload, ChevronDown, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, cn } from '@/lib/utils'

interface FileRecord {
  id: string
  feature_id: string
  game: string
  filename: string
  sha256: string | null
  version: string | null
  file_size: number | null
  status: string
  is_current: boolean
  uploaded_by: string
  created_at: string
  feature?: { label: string }
}

interface FeatureFlag { id: string; label: string; name: string }

export default function FileManagerPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [features, setFeatures] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    featureId: '', game: '', version: '', file: null as File | null,
  })

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const [featuresRes, filesRes] = await Promise.all([
        supabase.from('feature_flags').select('id, label, name').eq('has_file', true).order('sort_order'),
        supabase.from('files').select('*, feature:feature_flags(label)').order('created_at', { ascending: false }).limit(50),
      ])
      setFeatures(featuresRes.data || [])
      setFiles(filesRes.data as FileRecord[] || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const computeSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleUpload = async () => {
    if (!form.featureId || !form.game || !form.file) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const sha256 = await computeSHA256(form.file)
      const path = `files/${form.featureId}/${Date.now()}_${form.file.name}`

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(path, form.file)

      if (uploadError) { toast.error('Erro ao enviar arquivo: ' + uploadError.message); return }

      const { error: dbError } = await supabase.from('files').insert({
        feature_id: form.featureId,
        game: form.game.trim(),
        filename: form.file.name,
        storage_path: path,
        file_size: form.file.size,
        sha256,
        version: form.version.trim() || null,
        status: 'active',
        is_current: true,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      })

      if (dbError) { toast.error('Erro ao registrar arquivo'); return }

      toast.success('Arquivo enviado!')
      setUploadModal(false)
      setForm({ featureId: '', game: '', version: '', file: null })

      // Refresh
      const { data } = await supabase.from('files').select('*, feature:feature_flags(label)').order('created_at', { ascending: false }).limit(50)
      setFiles(data as FileRecord[] || [])
    } catch (e: any) { toast.error(e.message || 'Erro ao enviar') }
    finally { setUploading(false) }
  }

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <FileCode className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">File Manager</h1>
            <p className="text-sm text-text-muted">Gerencie os arquivos das features</p>
          </div>
        </div>
        <button onClick={() => setUploadModal(true)} className="btn-primary">
          <Upload className="w-4 h-4" />
          Enviar Arquivo
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-status-info-bg border border-status-info-border">
        <AlertTriangle className="w-4 h-4 text-status-info mt-0.5 shrink-0" />
        <p className="text-xs text-status-info">
          O SHA256 é calculado automaticamente no momento do upload. A validação específica do formato de arquivo será configurada durante a integração com o projeto externo.
        </p>
      </div>

      {/* Files table */}
      <div className="card-viibe overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-viibe">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Jogo</th>
                <th>Arquivo</th>
                <th>SHA256</th>
                <th>Versão</th>
                <th>Tamanho</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                  ))}</tr>
                ))
              ) : files.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon={FileCode} title="Nenhum arquivo enviado"
                    description="Envie o primeiro arquivo para uma feature." />
                </td></tr>
              ) : files.map(f => (
                <tr key={f.id}>
                  <td>
                    <span className="text-xs font-mono font-semibold text-accent-blue">
                      {(f.feature as any)?.label || '—'}
                    </span>
                  </td>
                  <td className="text-xs">{f.game}</td>
                  <td className="text-xs font-mono text-text-secondary max-w-[150px] truncate">{f.filename}</td>
                  <td>
                    {f.sha256 ? (
                      <span className="text-xs font-mono text-text-muted">{f.sha256.slice(0, 12)}...</span>
                    ) : '—'}
                  </td>
                  <td className="text-xs">{f.version || '—'}</td>
                  <td className="text-xs">{formatBytes(f.file_size)}</td>
                  <td>
                    <span className={cn('text-xs font-medium', f.status === 'active' ? 'text-status-success' : 'text-text-muted')}>
                      {f.is_current ? '● Atual' : f.status}
                    </span>
                  </td>
                  <td className="text-xs">{formatDate(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-md shadow-modal animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Enviar Arquivo</h2>
              <button onClick={() => setUploadModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Feature select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Feature *</label>
                <select value={form.featureId} onChange={e => setForm(p => ({ ...p, featureId: e.target.value }))}
                  className="input-viibe">
                  <option value="">Selecione a feature</option>
                  {features.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              {/* Game */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Jogo *</label>
                <input type="text" value={form.game} onChange={e => setForm(p => ({ ...p, game: e.target.value }))}
                  placeholder="Ex: Free Fire, BGMI..." className="input-viibe" />
              </div>

              {/* Version */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Versão</label>
                <input type="text" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
                  placeholder="Ex: 1.0.0" className="input-viibe" />
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Arquivo *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-accent-blue/50 cursor-pointer transition-colors"
                >
                  {form.file ? (
                    <><CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{form.file.name}</p>
                      <p className="text-xs text-text-muted">{(form.file.size / 1024).toFixed(1)} KB</p>
                    </div></>
                  ) : (
                    <><Upload className="w-5 h-5 text-text-muted shrink-0" />
                    <p className="text-sm text-text-muted">Clique para selecionar o arquivo</p></>
                  )}
                </div>
                <input ref={fileRef} type="file" onChange={e => setForm(p => ({ ...p, file: e.target.files?.[0] || null }))} className="hidden" />
              </div>

              {form.file && (
                <div className="p-3 rounded-xl bg-background-secondary border border-border text-xs font-mono text-text-muted">
                  SHA256: será calculado no upload
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setUploadModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
