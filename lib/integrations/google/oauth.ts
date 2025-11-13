import { PLATFORM_CONFIGS } from "@/types/platforms"
import { Platform } from "@prisma/client"

const googleConfig = PLATFORM_CONFIGS[Platform.GOOGLE_SHOPPING]

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: googleConfig.clientId!,
    redirect_uri: googleConfig.redirectUri!,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/content",
    access_type: "offline",
    prompt: "consent",
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: googleConfig.clientId!,
      client_secret: googleConfig.clientSecret!,
      redirect_uri: googleConfig.redirectUri!,
      grant_type: "authorization_code",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google token exchange failed: ${error}`)
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
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: googleConfig.clientId!,
      client_secret: googleConfig.clientSecret!,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google token refresh failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
