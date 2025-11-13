import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { exchangeCodeForToken, verifyHmac } from "@/lib/integrations/shopify/oauth"
import { storePlatformConnection } from "@/lib/integrations/connection-manager"
import { ShopifyApiClient } from "@/lib/integrations/shopify/client"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get("code")
    const shop = searchParams.get("shop")
    const state = searchParams.get("state")
    const hmac = searchParams.get("hmac")

    if (!code || !shop || !hmac) {
      return NextResponse.redirect(
        new URL("/dashboard/platforms?error=missing_params", req.url)
      )
    }

    // Verify HMAC for security
    const query: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      query[key] = value
    })

    if (!verifyHmac(query)) {
      return NextResponse.redirect(
        new URL("/dashboard/platforms?error=invalid_hmac", req.url)
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const { accessToken, scope } = await exchangeCodeForToken(shop, code)

    // Get shop info
    const shopifyClient = new ShopifyApiClient(accessToken, shop)
    let shopInfo
    try {
      shopInfo = await shopifyClient.getShop()
    } catch (err) {
      console.error("Failed to fetch Shopify shop info:", err)
      shopInfo = null
    }

    await storePlatformConnection(
      user.id,
      Platform.SHOPIFY,
      {
        accessToken,
        scope,
      },
      {
        shop,
        shopName: shopInfo?.name,
        shopEmail: shopInfo?.email,
        domain: shopInfo?.domain,
      }
    )

    return NextResponse.redirect(
      new URL("/dashboard/platforms?success=shopify_connected", req.url)
    )
  } catch (error) {
    console.error("Shopify OAuth callback error:", error)
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=connection_failed", req.url)
    )
  }
}
