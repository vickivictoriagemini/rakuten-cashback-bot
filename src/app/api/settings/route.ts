import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  let settings = await prisma.systemSetting.findFirst()
  if (!settings) {
    settings = await prisma.systemSetting.create({
      data: {}
    })
  }
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const existing = await prisma.systemSetting.findFirst()
    
    let settings
    if (existing) {
      settings = await prisma.systemSetting.update({
        where: { id: existing.id },
        data: {
          telegramToken: data.telegramToken,
          telegramChatId: data.telegramChatId,
          globalThreshold: parseFloat(data.globalThreshold),
        }
      })
    } else {
      settings = await prisma.systemSetting.create({
        data: {
          telegramToken: data.telegramToken,
          telegramChatId: data.telegramChatId,
          globalThreshold: parseFloat(data.globalThreshold),
        }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
