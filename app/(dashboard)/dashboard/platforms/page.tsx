"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Platform } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PLATFORM_CONFIGS } from "@/types/platforms"

interface PlatformConnection {
  id: string
  platform: Platform
  status: string
  createdAt: Date
}

export default function PlatformsPage() {
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<PlatformConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)

  // Show success/error messages from OAuth callbacks
  const success = searchParams?.get("success")
  const error = searchParams?.get("error")

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/platforms/connections")
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (err) {
      console.error("Failed to fetch connections:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platform: Platform) => {
    setConnectingPlatform(platform)

    try {
      const response = await fetch("/api/platforms/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      })

      const data = await response.json()

      if (data.authUrl) {
        // Redirect to OAuth authorization page
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || "Failed to get authorization URL")
      }
    } catch (err) {
      console.error("Connect error:", err)
      alert("Failed to connect platform")
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (platform: Platform) => {
    if (!confirm(`Are you sure you want to disconnect from ${platform}?`)) {
      return
    }

    try {
      await fetch("/api/platforms/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      })

      // Refresh connections
      fetchConnections()
    } catch (err) {
      console.error("Disconnect error:", err)
      alert("Failed to disconnect platform")
    }
  }

  const isConnected = (platform: Platform) => {
    return connections.some(
      (conn) => conn.platform === platform && conn.status === "ACTIVE"
    )
  }

  const priorityPlatforms = [Platform.EBAY, Platform.AMAZON, Platform.ETSY, Platform.SHOPIFY]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Connect Platforms</h1>
          <p className="text-muted-foreground">
            Connect your e-commerce platforms to start managing everything from one dashboard
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="text-3xl">✅</div>
                <div>
                  <h3 className="font-semibold text-green-900">Platform Connected!</h3>
                  <p className="text-sm text-green-700">
                    Your platform has been connected successfully. You can now start syncing your products and orders.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="text-3xl">❌</div>
                <div>
                  <h3 className="font-semibold text-red-900">Connection Failed</h3>
                  <p className="text-sm text-red-700">
                    {error === "no_code" && "Authorization code was not received"}
                    {error === "connection_failed" && "Failed to establish connection"}
                    {error === "invalid_state" && "Security validation failed. Please try again"}
                    {error === "invalid_hmac" && "Invalid security signature. Please try again"}
                    {error === "missing_params" && "Required parameters are missing"}
                    {!["no_code", "connection_failed", "invalid_state", "invalid_hmac", "missing_params"].includes(error) && `Error: ${error}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Priority Platforms */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Popular Platforms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {priorityPlatforms.map((platform) => {
              const config = PLATFORM_CONFIGS[platform]
              const connected = isConnected(platform)
              const connecting = connectingPlatform === platform

              return (
                <Card key={platform} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-4xl mb-2">{config.icon}</div>
                        <CardTitle className="text-lg">{config.displayName}</CardTitle>
                      </div>
                      {connected && (
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                          Connected
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDisconnect(platform)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleConnect(platform)}
                        disabled={connecting}
                      >
                        {connecting ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* All Platforms */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">All Platforms</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(PLATFORM_CONFIGS).map(([key, config]) => {
              const platform = key as Platform
              const connected = isConnected(platform)
              const isPriority = priorityPlatforms.includes(platform)

              if (isPriority) return null

              return (
                <Card key={platform} className="relative">
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl mb-2">{config.icon}</div>
                    <div className="text-sm font-medium mb-2">{config.displayName}</div>
                    {connected && (
                      <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Connected
                      </div>
                    )}
                    {!connected && !config.clientId && (
                      <div className="text-xs text-muted-foreground">
                        Coming Soon
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Connected Platforms Summary */}
        {connections.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Your Connected Platforms</CardTitle>
              <CardDescription>
                {connections.filter((c) => c.status === "ACTIVE").length} platform(s) connected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {connections.map((conn) => {
                  const config = PLATFORM_CONFIGS[conn.platform]
                  return (
                    <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{config.icon}</div>
                        <div>
                          <div className="font-medium">{config.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            Connected on {new Date(conn.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`text-xs px-2 py-1 rounded ${
                            conn.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {conn.status}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnect(conn.platform)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
