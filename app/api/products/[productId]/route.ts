import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { productUpdateSchema } from "@/lib/validations/product"

export async function GET(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth()

    const product = await prisma.product.findFirst({
      where: {
        id: params.productId,
        userId: user.id,
      },
      include: {
        platformListings: true,
        inventoryLogs: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error("Get product error:", error)
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validatedData = productUpdateSchema.parse(body)

    const product = await prisma.product.findFirst({
      where: {
        id: params.productId,
        userId: user.id,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    const updated = await prisma.product.update({
      where: { id: params.productId },
      data: validatedData,
    })

    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error("Update product error:", error)
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth()

    const product = await prisma.product.findFirst({
      where: {
        id: params.productId,
        userId: user.id,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    await prisma.product.delete({
      where: { id: params.productId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete product error:", error)
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    )
  }
}
