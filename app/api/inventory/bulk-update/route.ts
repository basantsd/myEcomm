import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { updates } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      )
    }

    const syncEngine = new InventorySyncEngine(user.id)

    // First, update local database
    for (const update of updates) {
      const product = await prisma.product.findUnique({
        where: { sku: update.sku },
      })

      if (product) {
        const oldQuantity = product.quantity

        await prisma.product.update({
          where: { sku: update.sku },
          data: { quantity: update.quantity },
        })

        // Log the change
        await prisma.inventoryLog.create({
          data: {
            productId: product.id,
            oldQuantity,
            newQuantity: update.quantity,
            changeReason: update.reason || "Bulk update",
          },
        })
      }
    }

    // Then sync to platforms if requested
    let syncResults = []
    if (updates[0]?.platforms && updates[0].platforms.length > 0) {
      syncResults = await syncEngine.bulkUpdateInventory(updates)
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
      syncResults,
    })
  } catch (error) {
    console.error("Bulk inventory update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update inventory" },
      { status: 500 }
    )
  }
}
