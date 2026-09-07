import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AuditService } from '@/lib/services/audit.service'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { ...profile, userId: user.id }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    const service = await createServiceClient()
    let query = service
      .from('mod_skins')
      .select('*')
      .order('sort_order')

    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[GET /api/admin/skins]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { name, filename, preview_url, preview_storage_path } = body

    if (!name?.trim() || !filename?.trim()) {
      return NextResponse.json({ error: 'Nome e filename são obrigatórios' }, { status: 400 })
    }

    // Validate filename format
    if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
      return NextResponse.json({ error: 'Filename inválido. Use apenas letras, números, _ e -' }, { status: 400 })
    }

    const service = await createServiceClient()

    const { data, error } = await service
      .from('mod_skins')
      .insert({
        name: name.trim(),
        filename: filename.trim(),
        preview_url: preview_url || null,
        preview_storage_path: preview_storage_path || null,
        created_by: admin.userId,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Filename já está em uso' }, { status: 400 })
      }
      throw error
    }

    await AuditService.log({
      actorId: admin.userId,
      action: 'skin_created',
      resourceType: 'mod_skin',
      resourceId: data.id,
      newValues: { name, filename },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[POST /api/admin/skins]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
