import { NextRequest, NextResponse } from "next/server"
import { Platform } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { getEbayAuthUrl } from "@/lib/integrations/ebay/oauth"
import { getAmazonAuthUrl } from "@/lib/integrations/amazon/oauth"
import { getEtsyAuthUrl, generateCodeVerifier } from "@/lib/integrations/etsy/oauth"
import { getShopifyAuthUrl } from "@/lib/integrations/shopify/oauth"
import { getGoogleAuthUrl } from "@/lib/integrations/google/oauth"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { platform, shop } = await req.json()

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
    let codeVerifier: string | undefined

    switch (platform.toUpperCase()) {
      case Platform.EBAY:
        authUrl = getEbayAuthUrl(state)
        break

      case Platform.AMAZON:
        authUrl = getAmazonAuthUrl(state)
        break

      case Platform.ETSY:
        codeVerifier = generateCodeVerifier()
        authUrl = getEtsyAuthUrl(state, codeVerifier)
        break

      case Platform.SHOPIFY:
        if (!shop) {
          return NextResponse.json(
            { error: "Shop domain is required for Shopify" },
            { status: 400 }
          )
        }
        authUrl = getShopifyAuthUrl(shop, state)
        break

      case Platform.GOOGLE_SHOPPING:
        authUrl = getGoogleAuthUrl(state)
        break

      default:
        return NextResponse.json(
          { error: `Platform ${platform} is not yet supported` },
          { status: 400 }
        )
    }

    // Create response with authUrl
    const response = NextResponse.json({
      authUrl,
      state,
    })

    // Store code verifier in cookie for Etsy (needed for PKCE)
    if (codeVerifier) {
      response.cookies.set("etsy_code_verifier", codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
      })
    }

    // Store state in cookie for CSRF protection
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    })

    return response
  } catch (error) {
    console.error("Platform connect error:", error)
    return NextResponse.json(
      { error: "Failed to initiate platform connection" },
      { status: 500 }
    )
  }
}
