import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { syncCoordinator } from "@/lib/sync/coordinator"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { syncType } = body

    if (!syncType || !["orders", "inventory", "products"].includes(syncType)) {
      return NextResponse.json(
        { error: "Invalid sync type. Must be: orders, inventory, or products" },
        { status: 400 }
      )
    }

    await syncCoordinator.triggerUserSync(user.id, syncType)

    return NextResponse.json({
      success: true,
      message: `${syncType} sync triggered successfully`,
    })
  } catch (error) {
    console.error("Trigger sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger sync" },
      { status: 500 }
    )
  }
}
