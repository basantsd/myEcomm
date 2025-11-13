import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { OrderSyncEngine } from "@/lib/sync/order-sync"
import { orderImportSchema } from "@/lib/validations/order"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validatedData = orderImportSchema.parse(body)

    const syncEngine = new OrderSyncEngine(user.id)
    const results = await syncEngine.importOrders(
      validatedData.platforms as Platform[],
      {
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        status: validatedData.status,
        limit: validatedData.limit,
      }
    )

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length
    const totalOrders = results.reduce((sum, r) => sum + (r.orderCount || 0), 0)

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        ordersImported: totalOrders,
      },
    })
  } catch (error) {
    console.error("Import orders error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import orders" },
      { status: 500 }
    )
  }
}
