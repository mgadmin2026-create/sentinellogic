// POST /api/reporting — Freitext-Anfrage -> read-only SQL (Claude) -> Ausführung via RPC
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateReportSql, validateSelectSql } from '@/lib/report-query'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return Response.json({ success: false, error: 'Bitte eine Frage eingeben.' }, { status: 400 })
    }

    // 1. NL -> SQL
    let generated
    try {
      generated = await generateReportSql(prompt.trim())
    } catch (err) {
      console.error('[Reporting] SQL-Generierung fehlgeschlagen:', err)
      return Response.json(
        { success: false, error: err instanceof Error ? err.message : 'SQL-Generierung fehlgeschlagen' },
        { status: 500 }
      )
    }

    if (!generated.sql) {
      return Response.json({
        success: false,
        error: generated.explanation || 'Für diese Anfrage konnte keine Abfrage erstellt werden.',
      })
    }

    // 2. Guard (erste Verteidigungslinie; DB-Funktion prüft ebenfalls)
    const check = validateSelectSql(generated.sql)
    if (!check.ok) {
      return Response.json({
        success: false,
        error: `Abfrage abgelehnt: ${check.error}`,
        sql: generated.sql,
        explanation: generated.explanation,
      })
    }

    // 3. Ausführung über abgesicherte DB-Funktion
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc('execute_report_query', { query: generated.sql })

    if (error) {
      console.error('[Reporting] DB-Fehler:', error)
      return Response.json({
        success: false,
        error: `Datenbank-Fehler: ${error.message}`,
        sql: generated.sql,
        explanation: generated.explanation,
      })
    }

    const rows = Array.isArray(data) ? data : []

    return Response.json({
      success: true,
      sql: generated.sql,
      explanation: generated.explanation,
      rows,
      rowCount: rows.length,
    })
  } catch (err) {
    console.error('[POST /api/reporting] Fehler:', err)
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
