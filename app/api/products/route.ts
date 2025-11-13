import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { productSchema } from "@/lib/validations/product"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status")

    const skip = (page - 1) * limit

    const where: any = { userId: user.id }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          platformListings: {
            select: {
              platform: true,
              platformProductId: true,
              status: true,
              lastSyncedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get products error:", error)
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validatedData = productSchema.parse(body)

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: validatedData.sku },
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: "Product with this SKU already exists" },
        { status: 400 }
      )
    }

    const product = await prisma.product.create({
      data: {
        ...validatedData,
        userId: user.id,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error("Create product error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    )
  }
}
