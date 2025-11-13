import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { exchangeCodeForToken } from "@/lib/integrations/etsy/oauth"
import { storePlatformConnection } from "@/lib/integrations/connection-manager"
import { EtsyApiClient } from "@/lib/integrations/etsy/client"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Get code_verifier from session/cookie (in production, store this securely)
    const codeVerifier = req.cookies.get("etsy_code_verifier")?.value

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/platforms?error=${error}`, req.url)
      )
    }

    if (!code || !codeVerifier) {
      return NextResponse.redirect(
        new URL("/dashboard/platforms?error=no_code", req.url)
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code, codeVerifier)

    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    // Get user shops
    const etsyClient = new EtsyApiClient(accessToken)
    let shops
    try {
      shops = await etsyClient.getUserShops()
    } catch (err) {
      console.error("Failed to fetch Etsy shops:", err)
      shops = []
    }

    await storePlatformConnection(
      user.id,
      Platform.ETSY,
      {
        accessToken,
        refreshToken,
        expiresAt,
      },
      {
        shops: shops.map((shop: any) => ({
          shopId: shop.shop_id,
          shopName: shop.shop_name,
        })),
      }
    )

    // Clear code verifier cookie
    const response = NextResponse.redirect(
      new URL("/dashboard/platforms?success=etsy_connected", req.url)
    )
    response.cookies.delete("etsy_code_verifier")

    return response
  } catch (error) {
    console.error("Etsy OAuth callback error:", error)
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=connection_failed", req.url)
    )
  }
}
