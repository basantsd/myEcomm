"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProfitMetrics {
  revenue: number
  cost: number
  profit: number
  margin: number
  roi: number
}

export default function ProfitPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30")
  const [metrics, setMetrics] = useState<ProfitMetrics | null>(null)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [platformMetrics, setPlatformMetrics] = useState<Record<string, ProfitMetrics>>({})
  const [forecast, setForecast] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any>(null)
  const [lowMarginProducts, setLowMarginProducts] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    try {
      const [analyticsRes, recommendationsRes, lowMarginRes] = await Promise.all([
        fetch(`/api/profit/analytics?period=${period}`),
        fetch(`/api/profit/recommendations?type=all`),
        fetch(`/api/profit/low-margin?minMargin=20`),
      ])

      const [analyticsData, recommendationsData, lowMarginData] = await Promise.all([
        analyticsRes.json(),
        recommendationsRes.json(),
        lowMarginRes.json(),
      ])

      setMetrics(analyticsData.metrics)
      setTopProducts(analyticsData.topProducts || [])
      setPlatformMetrics(analyticsData.platformMetrics || {})
      setForecast(analyticsData.forecast)
      setRecommendations(recommendationsData)
      setLowMarginProducts(lowMarginData.products || [])
    } catch (err) {
      console.error("Failed to fetch profit data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-lg">Loading profit analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">💰 Profit Maximizer</h1>
            <p className="text-muted-foreground">
              Analyze profitability and get recommendations to increase margins by 20%+
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="60">Last 60 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Revenue</CardDescription>
                <CardTitle className="text-2xl">${metrics.revenue.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Cost</CardDescription>
                <CardTitle className="text-2xl">${metrics.cost.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardDescription>Net Profit</CardDescription>
                <CardTitle className="text-2xl text-green-700">
                  ${metrics.profit.toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Profit Margin</CardDescription>
                <CardTitle className="text-2xl">{metrics.margin.toFixed(1)}%</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>ROI</CardDescription>
                <CardTitle className="text-2xl">{metrics.roi.toFixed(1)}%</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Profit Forecast */}
        {forecast && (
          <Card className="mb-8 border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle>📈 Profit Forecast (Next {period} days)</CardTitle>
              <CardDescription>Based on historical growth trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Forecasted Revenue</p>
                  <p className="text-2xl font-bold">${forecast.forecastedRevenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Forecasted Profit</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${forecast.forecastedProfit.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Confidence Level</p>
                  <p className="text-2xl font-bold">{forecast.confidenceLevel.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profit Recommendations */}
        {recommendations?.impact && (
          <Card className="mb-8 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle>💡 Profit Increase Potential</CardTitle>
              <CardDescription>Estimated revenue increase from implementing recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Cross-Sell Impact</p>
                  <p className="text-xl font-bold text-blue-700">
                    +${recommendations.impact.crossSellImpact.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">+15% revenue</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bundle Impact</p>
                  <p className="text-xl font-bold text-blue-700">
                    +${recommendations.impact.bundleImpact.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">+10% revenue</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Upsell Impact</p>
                  <p className="text-xl font-bold text-blue-700">
                    +${recommendations.impact.upsellImpact.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">+8% revenue</p>
                </div>
                <div className="border-l-2 border-blue-300 pl-4">
                  <p className="text-sm text-muted-foreground mb-1">Total Potential</p>
                  <p className="text-2xl font-bold text-blue-700">
                    +${recommendations.impact.totalImpact.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">+33% revenue boost!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Profitable Products */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 Top Profitable Products</CardTitle>
              <CardDescription>Products generating the most profit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.slice(0, 5).map((product, index) => (
                  <div key={product.sku} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{product.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.unitsSold} units • {product.margin.toFixed(1)}% margin
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-700">
                        ${product.profit.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">profit</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Platform Profitability */}
          <Card>
            <CardHeader>
              <CardTitle>🌐 Profit by Platform</CardTitle>
              <CardDescription>Compare profitability across platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(platformMetrics).map(([platform, metrics]) => (
                  <div key={platform} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{platform}</p>
                      <p className="text-sm text-muted-foreground">
                        ${metrics.revenue.toFixed(2)} revenue • {metrics.margin.toFixed(1)}% margin
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-700">
                        ${metrics.profit.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">profit</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Margin Alert */}
        {lowMarginProducts.length > 0 && (
          <Card className="mb-8 border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle>⚠️ Low Margin Products</CardTitle>
              <CardDescription>
                {lowMarginProducts.length} products with margins below 20% - Consider price increase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowMarginProducts.slice(0, 5).map((product) => (
                  <div key={product.sku} className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-700">{product.margin.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">margin</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Bundles */}
        {recommendations?.bundles && recommendations.bundles.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>📦 Recommended Product Bundles</CardTitle>
              <CardDescription>Create these bundles to increase average order value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.bundles.slice(0, 3).map((bundle: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">{bundle.name}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Individual Price</p>
                        <p className="text-lg line-through">${bundle.individualPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bundle Price</p>
                        <p className="text-lg font-bold text-green-700">
                          ${bundle.bundlePrice.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">
                        Includes {bundle.products.length} products • Save ${bundle.savings.toFixed(2)} (
                        {bundle.savingsPercentage}%)
                      </p>
                      <Button size="sm">Create Bundle</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products to Promote */}
        {recommendations?.productsToPromote && recommendations.productsToPromote.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>🎯 Products to Promote</CardTitle>
              <CardDescription>High-margin products worth promoting for maximum profit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.productsToPromote.slice(0, 5).map((product: any) => (
                  <div key={product.sku} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.unitsSold} units sold • {product.margin.toFixed(1)}% margin
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-700">
                          ${product.profit.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">profit</p>
                      </div>
                      <Button size="sm">Promote</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
