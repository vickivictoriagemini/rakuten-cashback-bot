import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reschedule } from '@/lib/scheduler'

export async function GET() {
  let settings = await prisma.systemSetting.findFirst()
  if (!settings) {
    settings = await prisma.systemSetting.create({ data: {} })
  }
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const existing = await prisma.systemSetting.findFirst()

    const payload = {
      telegramToken:   data.telegramToken   ?? '',
      telegramChatId:  data.telegramChatId  ?? '',
      globalThreshold: parseFloat(data.globalThreshold) || 15.0,
      scheduleTime:    data.scheduleTime    ?? '09:00',
      scheduleEnabled: data.scheduleEnabled !== false,  // default true
    }

    const settings = existing
      ? await prisma.systemSetting.update({ where: { id: existing.id }, data: payload })
      : await prisma.systemSetting.create({ data: payload })

    // Apply new schedule immediately (no restart required)
    await reschedule()

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
