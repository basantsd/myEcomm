import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { exchangeCodeForToken } from "@/lib/integrations/amazon/oauth"
import { storePlatformConnection } from "@/lib/integrations/connection-manager"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get("spapi_oauth_code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/platforms?error=${error}`, req.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/dashboard/platforms?error=no_code", req.url)
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code)

    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    await storePlatformConnection(
      user.id,
      Platform.AMAZON,
      {
        accessToken,
        refreshToken,
        expiresAt,
      }
    )

    return NextResponse.redirect(
      new URL("/dashboard/platforms?success=amazon_connected", req.url)
    )
  } catch (error) {
    console.error("Amazon OAuth callback error:", error)
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=connection_failed", req.url)
    )
  }
}
