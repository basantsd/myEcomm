import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { ProductSyncEngine } from "@/lib/sync/product-sync"

export async function POST(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth()
    const { platforms } = await req.json()

    if (!platforms || !Array.isArray(platforms)) {
      return NextResponse.json(
        { error: "Platforms array is required" },
        { status: 400 }
      )
    }

    const syncEngine = new ProductSyncEngine(user.id)
    const results = await syncEngine.syncProduct(params.productId, platforms as Platform[])

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    })
  } catch (error) {
    console.error("Sync product error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync product" },
      { status: 500 }
    )
  }
}
