import { NextResponse } from 'next/server'
import { testKlickTippConnection } from '@/lib/klicktipp-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await testKlickTippConnection()
    return NextResponse.json({
      success: true,
      message: 'KlickTipp-Verbindung erfolgreich',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[KlickTipp Verbindungstest] Fehlgeschlagen:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
