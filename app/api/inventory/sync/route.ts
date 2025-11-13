import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { action, platforms, productId } = body

    if (!action || !platforms || !Array.isArray(platforms)) {
      return NextResponse.json(
        { error: "Action and platforms array are required" },
        { status: 400 }
      )
    }

    const syncEngine = new InventorySyncEngine(user.id)
    let results

    if (action === "import") {
      // Import inventory from platforms to local database
      results = await syncEngine.importInventory(platforms as Platform[])
    } else if (action === "export" && productId) {
      // Export inventory from local database to platforms
      results = await syncEngine.syncInventoryToPlatforms(productId, platforms as Platform[])
    } else {
      return NextResponse.json(
        { error: "Invalid action or missing productId for export" },
        { status: 400 }
      )
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0)

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        updated: totalUpdated,
      },
    })
  } catch (error) {
    console.error("Inventory sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync inventory" },
      { status: 500 }
    )
  }
}
