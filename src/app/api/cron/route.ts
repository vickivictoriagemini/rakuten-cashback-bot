import { NextResponse } from 'next/server'
import { runScraper } from '@/services/scraper'

export async function GET(request: Request) {
  // Authorization check can be added here for Vercel Cron
  // e.g. const authHeader = request.headers.get('authorization')
  
  const result = await runScraper()
  
  return NextResponse.json(result)
}

export async function POST() {
  const result = await runScraper()
  return NextResponse.json(result)
}
