import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: false,
    error: 'Service Account integration is deprecated. Use OAuth instead.',
    info: 'Test OAuth integration at /api/debug/google-drive-oauth-test',
  }, { status: 410 })
}
