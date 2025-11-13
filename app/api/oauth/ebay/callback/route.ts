import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { exchangeCodeForToken } from "@/lib/integrations/ebay/oauth"
import { storePlatformConnection } from "@/lib/integrations/connection-manager"
import { EbayApiClient } from "@/lib/integrations/ebay/client"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Check for OAuth errors
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

    // Validate state for CSRF protection
    const savedState = req.cookies.get("oauth_state")?.value
    if (!state || !savedState || state !== savedState) {
      return NextResponse.redirect(
        new URL("/dashboard/platforms?error=invalid_state", req.url)
      )
    }

    // Get current user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code)

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    // Get user profile from eBay to store metadata
    const ebayClient = new EbayApiClient(accessToken, process.env.EBAY_ENVIRONMENT === "sandbox")
    let userProfile
    try {
      userProfile = await ebayClient.getUserProfile()
    } catch (err) {
      console.error("Failed to fetch eBay user profile:", err)
      userProfile = null
    }

    // Store the connection
    await storePlatformConnection(
      user.id,
      Platform.EBAY,
      {
        accessToken,
        refreshToken,
        expiresAt,
      },
      {
        userId: userProfile?.userId,
        username: userProfile?.username,
        email: userProfile?.email,
      }
    )

    // Redirect to success page and clear the state cookie
    const response = NextResponse.redirect(
      new URL("/dashboard/platforms?success=ebay_connected", req.url)
    )
    response.cookies.delete("oauth_state")
    return response
  } catch (error) {
    console.error("eBay OAuth callback error:", error)
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=connection_failed", req.url)
    )
  }
}
