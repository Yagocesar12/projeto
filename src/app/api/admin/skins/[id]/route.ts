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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { status, name, preview_url } = body

    const service = await createServiceClient()
    const updateData: Record<string, unknown> = {}

    if (status !== undefined) updateData.status = status
    if (name !== undefined) updateData.name = name.trim()
    if (preview_url !== undefined) updateData.preview_url = preview_url

    const { error } = await service
      .from('mod_skins')
      .update(updateData)
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await AuditService.log({
      actorId: admin.userId,
      action: status !== undefined ? 'skin_toggled' : 'skin_updated',
      resourceType: 'mod_skin',
      resourceId: params.id,
      newValues: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/admin/skins/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const service = await createServiceClient()

    const { data: skin } = await service
      .from('mod_skins')
      .select('filename, preview_storage_path, file_storage_path')
      .eq('id', params.id)
      .single()

    if (!skin) return NextResponse.json({ error: 'Skin não encontrada' }, { status: 404 })

    // Remove storage files if they exist
    if (skin.preview_storage_path) {
      await service.storage.from('skins').remove([skin.preview_storage_path])
    }
    if (skin.file_storage_path) {
      await service.storage.from('skins').remove([skin.file_storage_path])
    }

    const { error } = await service.from('mod_skins').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await AuditService.log({
      actorId: admin.userId,
      action: 'skin_deleted',
      resourceType: 'mod_skin',
      resourceId: params.id,
      oldValues: { filename: skin.filename },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/skins/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
