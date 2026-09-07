import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LicenseService } from '@/lib/services/license.service'
import { AuditService } from '@/lib/services/audit.service'
import { EmailService } from '@/lib/services/email.service'

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, status, credits, unlimited_credits, username, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status === 'blocked') return null
  return { user, profile }
}

// GET /api/licenses — lista licenças
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await getAuthenticatedUser(supabase)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)

    const result = await LicenseService.getLicenses({
      userId: auth.user.id,
      isAdmin: auth.profile.role === 'admin',
      status: searchParams.get('status') || undefined,
      activationState: searchParams.get('activation_state') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      perPage: parseInt(searchParams.get('per_page') || '20'),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/licenses]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/licenses — gerar licença(s)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await getAuthenticatedUser(supabase)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { durationKey, deviceLimit, quantity } = body

    // Validação básica de payload
    if (!durationKey || typeof durationKey !== 'string') {
      return NextResponse.json({ error: 'durationKey é obrigatório' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') || undefined

    const result = await LicenseService.generateLicense({
      ownerId: auth.user.id,
      durationKey,
      deviceLimit: parseInt(deviceLimit) || 1,
      quantity: parseInt(quantity) || 1,
      requestIp: ip,
    })

    if (!result.success) {
      const statusMap: Record<string, number> = {
        DURATION_NOT_ALLOWED: 403,
        DURATION_NOT_ALLOWED_FOR_RESELLER: 403,
        INSUFFICIENT_CREDITS: 402,
        ACCOUNT_BLOCKED: 403,
        USER_NOT_FOUND: 404,
      }
      return NextResponse.json(
        { error: result.error },
        { status: statusMap[result.error || ''] || 400 }
      )
    }

    // Enviar email (não bloqueia response)
    if (result.licenses?.[0]) {
      const first = result.licenses[0]
      EmailService.sendKeyGenerated({
        to: auth.profile.email,
        username: auth.profile.username,
        keyLast4: first.last4,
        duration: first.duration,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, licenses: result.licenses })
  } catch (error) {
    console.error('[POST /api/licenses]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
