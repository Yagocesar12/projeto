import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GHOST Panel', template: '%s — GHOST Panel' },
  description: 'Painel de gerenciamento de revendedores',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-text-primary">
        {/* Ghost watermark — appears subtly behind empty areas */}
        <div className="ghost-mark select-none pointer-events-none fixed bottom-[-40px] right-[-40px] z-0" aria-hidden>
          G
        </div>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E7E7E4',
              color: '#18181A',
              borderRadius: '8px',
              fontSize: '13px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
          }}
        />
      </body>
    </html>
  )
}
