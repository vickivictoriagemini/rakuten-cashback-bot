import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const rules = await prisma.categoryRule.findMany({ orderBy: { category: 'asc' } })
  return NextResponse.json(rules)
}

export async function POST(request: Request) {
  try {
    const { keyword, category, emoji } = await request.json()
    if (!keyword || !category) {
      return NextResponse.json({ error: 'keyword and category are required' }, { status: 400 })
    }
    const rule = await prisma.categoryRule.upsert({
      where: { keyword: keyword.toLowerCase().trim() },
      update: { category, emoji: emoji || '🛒' },
      create: { keyword: keyword.toLowerCase().trim(), category, emoji: emoji || '🛒' },
    })
    return NextResponse.json(rule)
  } catch {
    return NextResponse.json({ error: 'Failed to save rule' }, { status: 500 })
  }
}
