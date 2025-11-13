export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full items-center justify-between">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Multi-Platform E-Commerce
          </h1>
          <p className="text-2xl text-muted-foreground mb-8">
            One Dashboard to Rule Them All
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Manage all your selling platforms from a single, powerful interface.
            Connect eBay, Amazon, Etsy, Shopify, and 20+ more platforms.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Multi-Platform</h3>
              <p className="text-muted-foreground">
                Connect 20+ e-commerce platforms and marketplaces
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Real-Time Sync</h3>
              <p className="text-muted-foreground">
                Inventory updates across all platforms instantly
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-semibold mb-2">AI-Powered</h3>
              <p className="text-muted-foreground">
                Smart tools for content generation and optimization
              </p>
            </div>
          </div>

          <div className="mt-12">
            <p className="text-sm text-muted-foreground">
              Status: <span className="text-green-600 font-semibold">Development in Progress</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Current Phase: Platform Integrations
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
