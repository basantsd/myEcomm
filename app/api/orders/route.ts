import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { orderSchema } from "@/lib/validations/order"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const platform = searchParams.get("platform")
    const status = searchParams.get("status")
    const search = searchParams.get("search") || ""

    const skip = (page - 1) * limit

    const where: any = { userId: user.id }

    if (platform) {
      where.platform = platform
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { platformOrderId: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: { orderDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get orders error:", error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validatedData = orderSchema.parse(body)

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
      where: {
        userId_platformOrderId: {
          userId: user.id,
          platformOrderId: validatedData.platformOrderId,
        },
      },
    })

    if (existingOrder) {
      return NextResponse.json(
        { error: "Order with this platform order ID already exists" },
        { status: 400 }
      )
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        platform: validatedData.platform as any,
        platformOrderId: validatedData.platformOrderId,
        status: validatedData.status,
        customerName: validatedData.customerName,
        customerEmail: validatedData.customerEmail,
        shippingAddress: validatedData.shippingAddress,
        total: validatedData.total,
        currency: validatedData.currency,
        orderDate: validatedData.orderDate,
        items: {
          create: validatedData.items.map((item) => ({
            sku: item.sku,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            platformItemId: item.platformItemId,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error("Create order error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}
