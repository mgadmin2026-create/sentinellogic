import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activities-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const contactId = params.id
    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    let query = supabase
      .from('contact_notes_history')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET /notes] Error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /notes] Error:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const contactId = params.id
    const body = await request.json()

    const { content, type = 'manual', category = 'general', created_by = 'user', metadata = {} } = body

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Notiz-Text erforderlich' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('contact_notes_history')
      .insert([
        {
          contact_id: contactId,
          content: content.trim(),
          type,
          category,
          created_by,
          metadata,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('[POST /notes] Error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Gesprächsvorbereitung, die explizit als Notiz gespeichert wurde, landet
    // zusätzlich in der fachlichen Aktivitäten-Historie (andere Notiz-Quellen
    // bleiben unverändert ohne Activity-Log, wie bisher). `type`/`category`
    // sind DB-Enums mit fester Werteliste (manual/system/dialfire_sync/activity
    // bzw. general/dialfire/klicktipp/internal/follow_up/call/email/meeting) —
    // die Herkunft "Call-Prep-Agent" wird deshalb separat in metadata markiert.
    if (metadata?.source === 'call_prep_agent') {
      const currentUser = await getCurrentUser()
      await logActivity(
        null,
        contactId,
        'call_prep_saved',
        'KI-Gesprächsvorbereitung als Notiz gespeichert',
        {},
        currentUser?.id
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /notes] Error:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const noteId = url.searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'noteId erforderlich' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, category, is_archived } = body

    const updateData: any = {}
    if (content) updateData.content = content.trim()
    if (category) updateData.category = category
    if (is_archived !== undefined) updateData.is_archived = is_archived

    const { data, error } = await supabase
      .from('contact_notes_history')
      .update(updateData)
      .eq('id', noteId)
      .eq('contact_id', params.id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /notes] Error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /notes] Error:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const noteId = url.searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'noteId erforderlich' },
        { status: 400 }
      )
    }

    // Soft delete: archivieren statt löschen
    const { data, error } = await supabase
      .from('contact_notes_history')
      .update({ is_archived: true })
      .eq('id', noteId)
      .eq('contact_id', params.id)
      .select()
      .single()

    if (error) {
      console.error('[DELETE /notes] Error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[DELETE /notes] Error:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
