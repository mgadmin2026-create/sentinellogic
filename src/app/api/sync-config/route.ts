import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSyncConfig, updateSyncConfig } from '@/lib/sync-runs/sync-config'

const supabase = createServerClient()

// GET: Fetch current Facebook Sync configuration
export async function GET(request: NextRequest) {
  try {
    const config = await getSyncConfig(supabase, 'facebook')
    return NextResponse.json(config)
  } catch (error) {
    console.error('GET /api/sync-config error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}

// PATCH: Update Facebook Sync configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled, interval_type } = body

    if (enabled === undefined || !interval_type) {
      return new NextResponse(
        JSON.stringify({ error: 'enabled and interval_type required' }),
        { status: 400 }
      )
    }

    const config = await updateSyncConfig(supabase, 'facebook', { enabled, interval_type })
    return NextResponse.json(config)
  } catch (error) {
    console.error('PATCH /api/sync-config error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}
