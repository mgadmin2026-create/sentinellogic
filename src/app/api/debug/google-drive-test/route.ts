import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Service Account integration is deprecated. Use OAuth instead.',
    info: 'Test OAuth integration at /api/debug/google-drive-oauth-test',
  }, { status: 410 })
}
