import { PLATFORM_CONFIGS } from "@/types/platforms"
import { Platform } from "@prisma/client"

const amazonConfig = PLATFORM_CONFIGS[Platform.AMAZON]

export function getAmazonAuthUrl(state: string): string {
  const params = new URLSearchParams({
    application_id: amazonConfig.clientId!,
    state,
    version: "beta",
  })

  return `${amazonConfig.authUrl}?${params.toString()}`
}

export async function exchangeCodeForToken(
  spapi_oauth_code: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: spapi_oauth_code,
      client_id: amazonConfig.clientId!,
      client_secret: amazonConfig.clientSecret!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Amazon token exchange failed: ${error}`)
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
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: amazonConfig.clientId!,
      client_secret: amazonConfig.clientSecret!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Amazon token refresh failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
