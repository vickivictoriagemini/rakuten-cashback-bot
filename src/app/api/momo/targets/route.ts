import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const targets = await prisma.momoTarget.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      history: {
        orderBy: { scrapedAt: 'desc' },
        take: 1,
      },
    },
  })
  return NextResponse.json(targets)
}

export async function POST(request: Request) {
  try {
    const { name, url, targetPrice, currency } = await request.json()
    if (!name || !url || !targetPrice) {
      return NextResponse.json({ error: 'name, url and targetPrice are required' }, { status: 400 })
    }
    const target = await prisma.momoTarget.create({
      data: {
        name,
        url,
        targetPrice: parseFloat(targetPrice),
        currency: currency ?? 'TWD',
      },
    })
    return NextResponse.json(target)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'This URL is already being monitored' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
  }
}
