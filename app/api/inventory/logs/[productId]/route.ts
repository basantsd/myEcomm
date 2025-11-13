import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"

export async function GET(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const limit = parseInt(searchParams.get("limit") || "50")

    const syncEngine = new InventorySyncEngine(user.id)
    const logs = await syncEngine.getInventoryLogs(params.productId, limit)

    return NextResponse.json({
      logs,
      productId: params.productId,
    })
  } catch (error) {
    console.error("Inventory logs error:", error)
    return NextResponse.json(
      { error: "Failed to fetch inventory logs" },
      { status: 500 }
    )
  }
}
