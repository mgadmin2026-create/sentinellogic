import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    let next_sync_at: Date | null = null

    if (enabled) {
      switch (interval_type) {
        case '15min':
          next_sync_at = new Date(now.getTime() + 15 * 60 * 1000)
          break
        case '30min':
          next_sync_at = new Date(now.getTime() + 30 * 60 * 1000)
          break
        case '60min':
          next_sync_at = new Date(now.getTime() + 60 * 60 * 1000)
          break
        case 'daily':
          next_sync_at = new Date(now)
          next_sync_at.setUTCHours(8, 0, 0, 0)
          if (next_sync_at <= now) {
            next_sync_at.setUTCDate(next_sync_at.getUTCDate() + 1)
          }
          break
        case 'weekly':
          next_sync_at = new Date(now)
          const currentDay = next_sync_at.getUTCDay()
          const daysUntilMonday = currentDay === 1 ? 7 : (1 - currentDay + 7) % 7 || 7
          next_sync_at.setUTCDate(next_sync_at.getUTCDate() + daysUntilMonday)
          next_sync_at.setUTCHours(8, 0, 0, 0)
          break
      }
    }

    // Update or insert config
    const { data, error } = await supabase
      .from('facebook_sync_config')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000', // Use static ID for single config
        enabled,
        interval_type,
        next_sync_at: next_sync_at?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
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
