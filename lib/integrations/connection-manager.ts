import { Platform, ConnectionStatus } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { OAuthTokens } from "@/types/platforms"

export async function storePlatformConnection(
  userId: string,
  platform: Platform,
  tokens: OAuthTokens,
  metadata?: any
) {
  const encryptedAccessToken = encrypt(tokens.accessToken)
  const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null

  return await prisma.platformConnection.upsert({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: ConnectionStatus.ACTIVE,
      metadata,
      updatedAt: new Date(),
    },
    create: {
      userId,
      platform,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: ConnectionStatus.ACTIVE,
      metadata,
    },
  })
}

export async function getPlatformConnection(userId: string, platform: Platform) {
  const connection = await prisma.platformConnection.findUnique({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
  })

  if (!connection) {
    return null
  }

  return {
    ...connection,
    accessToken: decrypt(connection.accessToken),
    refreshToken: connection.refreshToken ? decrypt(connection.refreshToken) : null,
  }
}

export async function getAllPlatformConnections(userId: string) {
  const connections = await prisma.platformConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })

  return connections.map((conn) => ({
    ...conn,
    // Don't decrypt tokens when listing all connections (security)
    accessToken: "***",
    refreshToken: "***",
  }))
}

export async function disconnectPlatform(userId: string, platform: Platform) {
  return await prisma.platformConnection.update({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
    data: {
      status: ConnectionStatus.DISCONNECTED,
      updatedAt: new Date(),
    },
  })
}

export async function updateConnectionStatus(
  userId: string,
  platform: Platform,
  status: ConnectionStatus,
  error?: string
) {
  return await prisma.platformConnection.update({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
    data: {
      status,
      metadata: error ? { lastError: error } : undefined,
      updatedAt: new Date(),
    },
  })
}
