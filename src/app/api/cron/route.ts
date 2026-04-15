// Force this route to be dynamic — prevents Next.js from trying to
// statically analyse puppeteer-extra during build, which causes a crash.
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runScraper } from '@/services/scraper'

export async function GET() {
  const result = await runScraper()
  return NextResponse.json(result)
}

export async function POST() {
  const result = await runScraper()
  return NextResponse.json(result)
}
