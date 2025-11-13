import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { syncCoordinator } from "@/lib/sync/coordinator"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()

    const status = await syncCoordinator.getSyncStatus(user.id)

    return NextResponse.json(status)
  } catch (error) {
    console.error("Get sync status error:", error)
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    )
  }
}
