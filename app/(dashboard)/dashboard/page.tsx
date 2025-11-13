import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {user.name}! 👋
          </h1>
          <p className="text-muted-foreground">
            Your autonomous e-commerce business is ready to launch
          </p>
        </div>

        {/* Status Banner */}
        <Card className="mb-8 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🚀</div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Your AI Team is Almost Ready!</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your first platform to activate your 10-person AI team that will run your business 24/7.
                </p>
                <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium">
                  Connect Platform →
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Team Preview */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your AI Team (Coming Soon)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: "Sarah",
                role: "Product Manager",
                icon: "👩‍💼",
                value: "$3,000/mo",
                status: "Waiting for platform connection"
              },
              {
                name: "Lisa",
                role: "Customer Service",
                icon: "👩‍💼",
                value: "$3,000/mo",
                status: "Waiting for platform connection"
              },
              {
                name: "Tom",
                role: "Price Optimizer",
                icon: "👨‍💼",
                value: "$4,000/mo",
                status: "Waiting for platform connection"
              },
              {
                name: "David",
                role: "Inventory Manager",
                icon: "👨‍💼",
                value: "$3,500/mo",
                status: "Waiting for platform connection"
              },
              {
                name: "Mike",
                role: "Order Fulfillment",
                icon: "👨‍💼",
                value: "$3,500/mo",
                status: "Waiting for platform connection"
              },
              {
                name: "Emma",
                role: "Marketing Specialist",
                icon: "👩‍💼",
                value: "$4,000/mo",
                status: "Waiting for platform connection"
              },
            ].map((agent) => (
              <Card key={agent.name} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-3xl mb-2">{agent.icon}</div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription>{agent.role}</CardDescription>
                    </div>
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {agent.value}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    ⏸️ {agent.status}
                  </div>
                </CardContent>
                <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-[2px]" />
              </Card>
            ))}
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <span className="font-medium">Total Team Value:</span> $432,000/year •
            <span className="font-medium ml-2">Your Cost:</span> $948/year •
            <span className="font-medium text-green-600 ml-2">Savings:</span> $431,052/year
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Connected Platforms</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Connect your first platform</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Products Managed</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Add products after connecting</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Time Saved This Week</CardDescription>
              <CardTitle className="text-3xl">0h</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Target: 38 hours/week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Profit Increase</CardDescription>
              <CardTitle className="text-3xl">0%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Target: 20%+ guaranteed</p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Follow these steps to activate your autonomous business</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <div className="font-medium">Connect Your First Platform</div>
                  <div className="text-sm text-muted-foreground">
                    Choose from eBay, Amazon, Etsy, Shopify, and 20+ more
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border opacity-50">
                <div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <div className="font-medium">Import Your Products</div>
                  <div className="text-sm text-muted-foreground">
                    Sync existing products or create new ones
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border opacity-50">
                <div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <div className="font-medium">Activate Your AI Team</div>
                  <div className="text-sm text-muted-foreground">
                    Let AI handle operations while you focus on strategy
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
