import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { orderUpdateSchema } from "@/lib/validations/order"

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth()

    const order = await prisma.order.findFirst({
      where: {
        id: params.orderId,
        userId: user.id,
      },
      include: {
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("Get order error:", error)
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validatedData = orderUpdateSchema.parse(body)

    const order = await prisma.order.findFirst({
      where: {
        id: params.orderId,
        userId: user.id,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    const updated = await prisma.order.update({
      where: { id: params.orderId },
      data: validatedData,
      include: {
        items: true,
      },
    })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error("Update order error:", error)
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requireAuth()

    const order = await prisma.order.findFirst({
      where: {
        id: params.orderId,
        userId: user.id,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    await prisma.order.delete({
      where: { id: params.orderId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete order error:", error)
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    )
  }
}
