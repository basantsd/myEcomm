import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { getAllPlatformConnections } from "@/lib/integrations/connection-manager"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()

    const connections = await getAllPlatformConnections(user.id)

    return NextResponse.json({ connections })
  } catch (error) {
    console.error("Get connections error:", error)
    return NextResponse.json(
      { error: "Failed to fetch platform connections" },
      { status: 500 }
    )
  }
}
