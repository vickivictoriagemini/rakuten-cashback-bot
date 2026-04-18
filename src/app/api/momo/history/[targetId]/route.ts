import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const { targetId } = await params
  const history = await prisma.momoPriceHistory.findMany({
    where: { targetId: parseInt(targetId) },
    orderBy: { scrapedAt: 'desc' },
    take: 30,
  })
  return NextResponse.json(history)
}
