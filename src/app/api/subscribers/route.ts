import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const subscribers = await prisma.telegramSubscriber.findMany({
      orderBy: { joinedAt: 'desc' }
    })
    
    const userTargets = await prisma.focusTarget.findMany({
      where: {
        NOT: [
          { chatId: null },
          { chatId: '' }
        ]
      }
    })

    const payload = subscribers.map((sub: any) => ({
      ...sub,
      targets: userTargets.filter((t: any) => t.chatId === sub.chatId)
    }))

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch subscribers:', error)
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
  }
}
