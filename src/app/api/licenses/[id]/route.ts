import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()
  if (!profile || profile.status === 'blocked') return null
  return { user, profile }
}

// PATCH /api/licenses/:id — ação na licença
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const auth = await getAuth(supabase)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // IDOR check — reseller só pode agir nas próprias
    if (auth.profile.role === 'reseller') {
      const { data: lic } = await supabase
        .from('licenses')
        .select('owner_id')
        .eq('id', params.id)
        .single()

      if (!lic || lic.owner_id !== auth.user.id) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { action, reason } = body

    // Reseller não pode pausar/despausar
    const ADMIN_ONLY = ['PAUSE', 'UNPAUSE']
    if (auth.profile.role === 'reseller' && ADMIN_ONLY.includes(action)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    if (!['BLOCK', 'UNBLOCK', 'RESET', 'PAUSE', 'UNPAUSE'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    if (action === 'BLOCK' && !reason?.trim()) {
      return NextResponse.json({ error: 'Motivo obrigatório para bloquear' }, { status: 400 })
    }

    // Obter JWT do usuário para passar para a Edge Function
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })

    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/license-api/admin/action`
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, license_id: params.id, reason }),
    })

    const data = await edgeRes.json()

    if (!edgeRes.ok || !data.success) {
      return NextResponse.json({ error: data.error || 'Falha na ação' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/licenses/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
