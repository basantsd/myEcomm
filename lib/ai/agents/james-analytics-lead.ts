import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * James - Analytics Lead AI
 * Analyzes sales data and provides business insights
 */
export class JamesAnalyticsLead extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "ANALYTICS_LEAD")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Generate sales analytics
      await this.generateSalesAnalytics()

      // Task 2: Identify trending products
      await this.identifyTrendingProducts()

      // Task 3: Analyze platform performance
      await this.analyzePlatformPerformance()

      // Task 4: Generate business insights
      await this.generateBusinessInsights()

      // Task 5: Create performance reports
      await this.createPerformanceReports()

      this.setStatus("idle")
    } catch (error) {
      console.error("James execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { salesData, timeframe } = context

    if (!salesData) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No sales data provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const growthRate = this.calculateGrowthRate(salesData)
    const trend = growthRate > 0 ? "growing" : growthRate < 0 ? "declining" : "stable"

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.85

    if (growthRate < -10) {
      decision = "alert_declining_sales"
      actions.push("Investigate declining sales causes")
      actions.push("Review underperforming products")
      actions.push("Analyze competitor activity")
      actions.push("Recommend promotional campaigns")
      confidence = 0.9
    } else if (growthRate > 20) {
      decision = "scale_operations"
      actions.push("Increase inventory for hot products")
      actions.push("Expand to additional platforms")
      actions.push("Invest more in marketing")
      confidence = 0.85
    } else if (growthRate > 5) {
      decision = "optimize_growth"
      actions.push("Double down on winning strategies")
      actions.push("Optimize pricing for popular items")
      actions.push("Increase ad spend on best performers")
      confidence = 0.8
    }

    return {
      decision,
      confidence,
      reasoning: `Sales are ${trend} at ${Math.abs(growthRate).toFixed(1)}% ${growthRate > 0 ? "growth" : "decline"} rate`,
      suggestedActions: actions,
      requiresApproval: Math.abs(growthRate) > 15 || await this.requiresApproval(),
    }
  }

  private async generateSalesAnalytics(): Promise<void> {
    const action = await this.logAction(
      "generate_sales_analytics",
      "Generating comprehensive sales analytics"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      // Get orders from last 30 days
      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          orderDate: { gte: thirtyDaysAgo },
        },
        include: {
          items: true,
        },
      })

      // Calculate key metrics
      const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0)
      const totalOrders = orders.length
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Calculate by platform
      const platformBreakdown = this.groupByPlatform(orders)

      // Calculate by day
      const dailySales = this.groupByDay(orders)

      // Best selling products
      const productSales = this.calculateProductSales(orders)

      const analytics = {
        period: "Last 30 Days",
        totalRevenue,
        totalOrders,
        averageOrderValue,
        platformBreakdown,
        dailySales,
        topProducts: productSales.slice(0, 10),
        generatedAt: new Date(),
      }

      // Create notification with insights
      await prisma.notification.create({
        data: {
          userId: this.userId,
          type: "SYSTEM_ALERT",
          title: "Monthly Analytics Report Ready",
          message: `Revenue: $${totalRevenue.toFixed(2)} | Orders: ${totalOrders} | AOV: $${averageOrderValue.toFixed(2)}`,
          priority: "MEDIUM",
          metadata: analytics,
        },
      })

      await this.completeAction(action.id, analytics)
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async identifyTrendingProducts(): Promise<void> {
    const action = await this.logAction(
      "identify_trending_products",
      "Identifying trending and hot-selling products"
    )

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

      // Get orders from last 7 days
      const recentOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          orderDate: { gte: sevenDaysAgo },
        },
        include: { items: true },
      })

      // Get orders from 7-14 days ago
      const previousOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          orderDate: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
        include: { items: true },
      })

      const recentSales = this.calculateProductSales(recentOrders)
      const previousSales = this.calculateProductSales(previousOrders)

      // Identify trending products (sales increasing week over week)
      const trending = []
      for (const recentProduct of recentSales) {
        const previousProduct = previousSales.find((p) => p.sku === recentProduct.sku)
        const previousQuantity = previousProduct?.quantity || 0

        if (recentProduct.quantity > previousQuantity) {
          const growthRate = previousQuantity > 0
            ? ((recentProduct.quantity - previousQuantity) / previousQuantity) * 100
            : 100

          trending.push({
            ...recentProduct,
            growthRate,
            previousQuantity,
          })
        }
      }

      trending.sort((a, b) => b.growthRate - a.growthRate)

      // Create notifications for hot products
      for (const product of trending.slice(0, 5)) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: `🔥 Trending Product: ${product.title}`,
            message: `Sales up ${product.growthRate.toFixed(0)}% week-over-week. Consider increasing inventory!`,
            priority: "HIGH",
            metadata: product,
          },
        })
      }

      await this.completeAction(action.id, {
        trendingProducts: trending.length,
        topTrending: trending.slice(0, 5),
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async analyzePlatformPerformance(): Promise<void> {
    const action = await this.logAction(
      "analyze_platform_performance",
      "Analyzing performance across all platforms"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          orderDate: { gte: thirtyDaysAgo },
        },
      })

      const platformStats = this.groupByPlatform(orders)

      // Calculate ROI and efficiency metrics for each platform
      const performanceRanking = Object.entries(platformStats)
        .map(([platform, stats]) => ({
          platform,
          ...stats,
          efficiency: stats.orders > 0 ? stats.revenue / stats.orders : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Identify underperforming platforms
      const avgRevenue = performanceRanking.reduce((sum, p) => sum + p.revenue, 0) / performanceRanking.length
      const underperforming = performanceRanking.filter((p) => p.revenue < avgRevenue * 0.5)

      if (underperforming.length > 0) {
        for (const platform of underperforming) {
          await prisma.notification.create({
            data: {
              userId: this.userId,
              type: "SYSTEM_ALERT",
              title: `Low Performance: ${platform.platform}`,
              message: `Only $${platform.revenue.toFixed(2)} in sales. Consider optimizing listings or reducing focus.`,
              priority: "MEDIUM",
              metadata: platform,
            },
          })
        }
      }

      await this.completeAction(action.id, {
        platformCount: performanceRanking.length,
        topPlatform: performanceRanking[0],
        performanceRanking,
        underperforming: underperforming.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async generateBusinessInsights(): Promise<void> {
    const action = await this.logAction(
      "generate_business_insights",
      "Generating actionable business insights"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

      const [currentPeriod, previousPeriod, products] = await Promise.all([
        prisma.order.findMany({
          where: { userId: this.userId, orderDate: { gte: thirtyDaysAgo } },
          include: { items: true },
        }),
        prisma.order.findMany({
          where: { userId: this.userId, orderDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
          include: { items: true },
        }),
        prisma.product.findMany({
          where: { userId: this.userId, status: "ACTIVE" },
        }),
      ])

      const insights = []

      // Insight 1: Revenue Growth
      const currentRevenue = currentPeriod.reduce((sum, o) => sum + Number(o.total), 0)
      const previousRevenue = previousPeriod.reduce((sum, o) => sum + Number(o.total), 0)
      const revenueGrowth = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0

      insights.push({
        type: "revenue_trend",
        title: revenueGrowth > 0 ? "📈 Revenue Growing" : "📉 Revenue Declining",
        message: `${Math.abs(revenueGrowth).toFixed(1)}% ${revenueGrowth > 0 ? "growth" : "decline"} vs previous period`,
        priority: Math.abs(revenueGrowth) > 20 ? "HIGH" : "MEDIUM",
        actionable: revenueGrowth < -10,
      })

      // Insight 2: Inventory Optimization
      const lowStockCount = products.filter((p) => p.quantity < 10).length
      const overStockCount = products.filter((p) => p.quantity > 100).length

      if (lowStockCount > 0) {
        insights.push({
          type: "inventory_alert",
          title: "⚠️ Low Stock Alert",
          message: `${lowStockCount} products need restocking`,
          priority: "HIGH",
          actionable: true,
        })
      }

      if (overStockCount > 0) {
        insights.push({
          type: "inventory_optimization",
          title: "📦 Excess Inventory",
          message: `${overStockCount} products overstocked. Consider promotions.`,
          priority: "MEDIUM",
          actionable: true,
        })
      }

      // Insight 3: Best Time to Sell
      const salesByHour = this.analyzeSalesTiming(currentPeriod)
      const bestHour = salesByHour.sort((a, b) => b.sales - a.sales)[0]

      insights.push({
        type: "timing_insight",
        title: "⏰ Peak Sales Time",
        message: `Most sales occur around ${bestHour.hour}:00. Schedule promotions accordingly.`,
        priority: "LOW",
        actionable: false,
      })

      // Create notifications
      for (const insight of insights.filter((i) => i.actionable)) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: insight.title,
            message: insight.message,
            priority: insight.priority as any,
            metadata: insight,
          },
        })
      }

      await this.completeAction(action.id, {
        insightsGenerated: insights.length,
        actionableInsights: insights.filter((i) => i.actionable).length,
        insights,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async createPerformanceReports(): Promise<void> {
    const action = await this.logAction(
      "create_performance_reports",
      "Creating comprehensive performance reports"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const [orders, products, connections] = await Promise.all([
        prisma.order.findMany({
          where: { userId: this.userId, orderDate: { gte: thirtyDaysAgo } },
          include: { items: true },
        }),
        prisma.product.findMany({
          where: { userId: this.userId },
        }),
        prisma.platformConnection.findMany({
          where: { userId: this.userId },
        }),
      ])

      const report = {
        generatedAt: new Date(),
        period: "Last 30 Days",
        summary: {
          totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
          totalOrders: orders.length,
          totalProducts: products.length,
          activeProducts: products.filter((p) => p.status === "ACTIVE").length,
          connectedPlatforms: connections.length,
        },
        topPerformers: {
          products: this.calculateProductSales(orders).slice(0, 5),
          platforms: Object.entries(this.groupByPlatform(orders))
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 3),
        },
        alerts: {
          lowStock: products.filter((p) => p.quantity < 10).length,
          outOfStock: products.filter((p) => p.quantity === 0).length,
        },
      }

      await this.completeAction(action.id, report)
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private calculateGrowthRate(salesData: any): number {
    if (!salesData.current || !salesData.previous) return 0
    if (salesData.previous === 0) return 100
    return ((salesData.current - salesData.previous) / salesData.previous) * 100
  }

  private groupByPlatform(orders: any[]): Record<string, any> {
    const grouped: Record<string, any> = {}

    for (const order of orders) {
      if (!grouped[order.platform]) {
        grouped[order.platform] = {
          revenue: 0,
          orders: 0,
          items: 0,
        }
      }

      grouped[order.platform].revenue += Number(order.total)
      grouped[order.platform].orders += 1
      grouped[order.platform].items += order.items.length
    }

    return grouped
  }

  private groupByDay(orders: any[]): Record<string, number> {
    const grouped: Record<string, number> = {}

    for (const order of orders) {
      const date = new Date(order.orderDate).toISOString().split("T")[0]
      grouped[date] = (grouped[date] || 0) + Number(order.total)
    }

    return grouped
  }

  private calculateProductSales(orders: any[]): any[] {
    const productMap: Record<string, any> = {}

    for (const order of orders) {
      for (const item of order.items) {
        if (!productMap[item.sku]) {
          productMap[item.sku] = {
            sku: item.sku,
            title: item.title,
            quantity: 0,
            revenue: 0,
          }
        }

        productMap[item.sku].quantity += item.quantity
        productMap[item.sku].revenue += Number(item.price) * item.quantity
      }
    }

    return Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
  }

  private analyzeSalesTiming(orders: any[]): any[] {
    const hourlyStats: Record<number, { hour: number; sales: number }> = {}

    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = { hour: i, sales: 0 }
    }

    for (const order of orders) {
      const hour = new Date(order.orderDate).getHours()
      hourlyStats[hour].sales += 1
    }

    return Object.values(hourlyStats)
  }
}
