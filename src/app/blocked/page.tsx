import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full card-viibe p-10 text-center animate-scale-in">
        <div className="flex justify-center mb-6">
          <div className="p-5 rounded-2xl bg-status-error-bg border border-status-error-border">
            <ShieldX className="w-10 h-10 text-status-error" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">Conta bloqueada</h1>
        <p className="text-text-muted text-sm leading-relaxed mb-2">
          Sua conta foi bloqueada por um administrador.
        </p>
        <p className="text-text-muted text-sm leading-relaxed mb-8">
          Entre em contato com o suporte para mais informações.
        </p>
        <Link href="/login" className="btn-secondary w-full">
          Voltar
        </Link>
      </div>
    </div>
  )
}
