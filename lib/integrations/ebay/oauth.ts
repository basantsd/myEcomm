import { PLATFORM_CONFIGS } from "@/types/platforms"
import { Platform } from "@prisma/client"

const ebayConfig = PLATFORM_CONFIGS[Platform.EBAY]

export function getEbayAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ebayConfig.clientId!,
    redirect_uri: ebayConfig.redirectUri!,
    response_type: "code",
    scope: ebayConfig.scopes!.join(" "),
    state,
  })

  return `${ebayConfig.authUrl}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const credentials = Buffer.from(
    `${ebayConfig.clientId}:${ebayConfig.clientSecret}`
  ).toString("base64")

  const response = await fetch(ebayConfig.tokenUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ebayConfig.redirectUri!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`eBay token exchange failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn: number
}> {
  const credentials = Buffer.from(
    `${ebayConfig.clientId}:${ebayConfig.clientSecret}`
  ).toString("base64")

  const response = await fetch(ebayConfig.tokenUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: ebayConfig.scopes!.join(" "),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`eBay token refresh failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
