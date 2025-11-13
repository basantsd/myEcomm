import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const threshold = parseInt(searchParams.get("threshold") || "10")

    const syncEngine = new InventorySyncEngine(user.id)
    const lowStockItems = await syncEngine.checkLowStock(threshold)

    return NextResponse.json({
      lowStockItems,
      count: lowStockItems.length,
      threshold,
    })
  } catch (error) {
    console.error("Low stock check error:", error)
    return NextResponse.json(
      { error: "Failed to check low stock" },
      { status: 500 }
    )
  }
}
