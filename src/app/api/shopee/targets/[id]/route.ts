import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const target = await prisma.shopeeTarget.update({
    where: { id: parseInt(id) },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.targetPrice !== undefined && { targetPrice: parseFloat(data.targetPrice) }),
      ...(data.active !== undefined && { active: data.active }),
    },
  })
  return NextResponse.json(target)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.shopeeTarget.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
