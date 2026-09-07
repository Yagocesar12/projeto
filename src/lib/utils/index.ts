import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCredits(credits: number, unlimited: boolean): string {
  if (unlimited) return '∞'
  return credits.toLocaleString('pt-BR')
}

export function formatDate(date: string | null, fallback = '—'): string {
  if (!date) return fallback
  try {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return fallback
  }
}

export function formatDateShort(date: string | null, fallback = '—'): string {
  if (!date) return fallback
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return fallback
  }
}

export function formatRelativeTime(date: string | null, fallback = '—'): string {
  if (!date) return fallback
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true, locale: ptBR })
  } catch {
    return fallback
  }
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function isExpired(date: string): boolean {
  try {
    return !isAfter(parseISO(date), new Date())
  } catch {
    return false
  }
}

export function generateKeyValue(prefix = 'GHOST'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const segments = [6, 6, 6]
  const parts = segments.map((len) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  )
  return `${prefix}-${parts.join('-')}`
}

export function maskKey(key: string): string {
  const parts = key.split('-')
  if (parts.length <= 1) return key
  return `${parts[0]}-${parts[1]}-****-****`
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function calculateCreditsAfter(
  current: number,
  unlimited: boolean,
  cost: number
): string {
  if (unlimited) return '∞'
  const after = current - cost
  if (after < 0) return 'Saldo insuficiente'
  return after.toLocaleString('pt-BR')
}
