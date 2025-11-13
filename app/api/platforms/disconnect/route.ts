import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { disconnectPlatform } from "@/lib/integrations/connection-manager"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { platform } = await req.json()

    if (!platform) {
      return NextResponse.json(
        { error: "Platform is required" },
        { status: 400 }
      )
    }

    await disconnectPlatform(user.id, platform as Platform)

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform}`,
    })
  } catch (error) {
    console.error("Platform disconnect error:", error)
    return NextResponse.json(
      { error: "Failed to disconnect platform" },
      { status: 500 }
    )
  }
}
