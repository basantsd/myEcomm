import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { getEbayAuthUrl } from "@/lib/integrations/ebay/oauth"
import crypto from "crypto"

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

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex")

    // Get authorization URL based on platform
    let authUrl: string

    switch (platform.toUpperCase()) {
      case Platform.EBAY:
        authUrl = getEbayAuthUrl(state)
        break

      default:
        return NextResponse.json(
          { error: `Platform ${platform} is not yet supported` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      authUrl,
      state,
    })
  } catch (error) {
    console.error("Platform connect error:", error)
    return NextResponse.json(
      { error: "Failed to initiate platform connection" },
      { status: 500 }
    )
  }
}
