import { PLATFORM_CONFIGS } from "@/types/platforms"
import { Platform } from "@prisma/client"
import crypto from "crypto"

const etsyConfig = PLATFORM_CONFIGS[Platform.ETSY]

export function getEtsyAuthUrl(state: string, codeVerifier: string): string {
  // Generate code challenge for PKCE
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  const params = new URLSearchParams({
    response_type: "code",
    client_id: etsyConfig.clientId!,
    redirect_uri: etsyConfig.redirectUri!,
    scope: etsyConfig.scopes!.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  return `${etsyConfig.authUrl}?${params.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const response = await fetch(etsyConfig.tokenUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: etsyConfig.clientId!,
      redirect_uri: etsyConfig.redirectUri!,
      code,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Etsy token exchange failed: ${error}`)
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
  const response = await fetch(etsyConfig.tokenUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: etsyConfig.clientId!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Etsy token refresh failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}
