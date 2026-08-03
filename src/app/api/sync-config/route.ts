import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { berechneNaechstenSync } from '@/lib/facebook-sync-schedule'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch current Facebook Sync configuration
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('facebook_sync_config')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync config:', error)
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch config' }),
        { status: 500 }
      )
    }

    // If no config exists, return defaults
    if (!data) {
      return new NextResponse(
        JSON.stringify({
          enabled: false,
          interval_type: '15min',
          daily_hour: 8,
          weekly_day: 1,
          weekly_hour: 8,
          last_sync_at: null,
          next_sync_at: null,
        }),
        { status: 200 }
      )
    }

    return new NextResponse(JSON.stringify(data), { status: 200 })
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

    // Calculate next_sync_at based on interval_type
    const now = new Date()
    const next_sync_at: Date | null = enabled ? berechneNaechstenSync(interval_type, now) : null

    // Get existing config ID first (should only be one)
    const { data: existing } = await supabase
      .from('facebook_sync_config')
      .select('id')
      .limit(1)
      .single()

    const configId = existing?.id || crypto.randomUUID()

    // Update or insert config
    const { data, error } = await supabase
      .from('facebook_sync_config')
      .upsert({
        id: configId,
        enabled,
        interval_type,
        next_sync_at: next_sync_at?.toISOString() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('Error updating sync config:', error)
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update config' }),
        { status: 500 }
      )
    }

    return new NextResponse(JSON.stringify(data), { status: 200 })
  } catch (error) {
    console.error('PATCH /api/sync-config error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}
