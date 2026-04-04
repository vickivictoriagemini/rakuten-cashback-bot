import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const targets = await prisma.focusTarget.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(targets)
}

export async function POST(request: Request) {
  try {
    const { name, keyword, threshold } = await request.json()
    const target = await prisma.focusTarget.create({
      data: {
        name,
        keyword,
        threshold: parseFloat(threshold)
      }
    })
    return NextResponse.json(target)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
  }
}
