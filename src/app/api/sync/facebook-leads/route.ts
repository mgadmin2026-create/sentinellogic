import { NextRequest, NextResponse } from 'next/server'
import { runFacebookLeadSync } from '@/lib/facebook-sync'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { status, body } = await runFacebookLeadSync()
  return new NextResponse(JSON.stringify(body), { status })
}
