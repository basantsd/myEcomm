import { PLATFORM_CONFIGS } from "@/types/platforms"
import { Platform } from "@prisma/client"
import crypto from "crypto"

const shopifyConfig = PLATFORM_CONFIGS[Platform.SHOPIFY]

export function getShopifyAuthUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: shopifyConfig.clientId!,
    scope: shopifyConfig.scopes!.join(","),
    redirect_uri: shopifyConfig.redirectUri!,
    state,
  })

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{
  accessToken: string
  scope: string
}> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: shopifyConfig.clientId!,
      client_secret: shopifyConfig.clientSecret!,
      code,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Shopify token exchange failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    scope: data.scope,
  }
}

export function verifyHmac(query: Record<string, string>): boolean {
  const { hmac, ...params } = query

  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")

  const generatedHash = crypto
    .createHmac("sha256", shopifyConfig.clientSecret!)
    .update(message)
    .digest("hex")

  return generatedHash === hmac
}
