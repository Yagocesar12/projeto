import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Public endpoint — consumed by external app in future integration
// Returns ONLY active skins, ONLY public fields
export async function GET(request: NextRequest) {
  try {
    const service = await createServiceClient()

    const { data, error } = await service
      .from('mod_skins')
      .select('name, filename, preview_url')
      .eq('status', 'active')
      .order('sort_order')

    if (error) throw error

    return NextResponse.json(
      { skins: data || [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('[GET /api/mod-skins]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
