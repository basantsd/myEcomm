import { prisma } from "@/lib/db/client"

export interface ProfitMetrics {
  revenue: number
  cost: number
  profit: number
  margin: number
  roi: number
}

export interface ProductProfitability {
  productId: string
  sku: string
  title: string
  revenue: number
  cost: number
  profit: number
  margin: number
  unitsSold: number
  averagePrice: number
}

export class ProfitAnalyzer {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Calculate overall profit metrics for a time period
   */
  async calculateProfitMetrics(startDate: Date, endDate: Date): Promise<ProfitMetrics> {
    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        orderDate: { gte: startDate, lte: endDate },
        status: { in: ["DELIVERED", "SHIPPED"] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    let totalRevenue = 0
    let totalCost = 0

    for (const order of orders) {
      totalRevenue += Number(order.total)

      for (const item of order.items) {
        if (item.product?.costPrice) {
          totalCost += Number(item.product.costPrice) * item.quantity
        } else {
          // Estimate cost as 70% of selling price if not available
          totalCost += Number(item.price) * item.quantity * 0.7
        }
      }
    }

    const profit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      margin,
      roi,
    }
  }

  /**
   * Get profitability analysis for each product
   */
  async getProductProfitability(startDate: Date, endDate: Date): Promise<ProductProfitability[]> {
    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        orderDate: { gte: startDate, lte: endDate },
        status: { in: ["DELIVERED", "SHIPPED"] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    const productMap: Record<string, ProductProfitability> = {}

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product) continue

        const sku = item.sku
        if (!productMap[sku]) {
          productMap[sku] = {
            productId: item.product.id,
            sku: sku,
            title: item.title,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0,
            unitsSold: 0,
            averagePrice: 0,
          }
        }

        const itemRevenue = Number(item.price) * item.quantity
        const itemCost = item.product.costPrice
          ? Number(item.product.costPrice) * item.quantity
          : itemRevenue * 0.7

        productMap[sku].revenue += itemRevenue
        productMap[sku].cost += itemCost
        productMap[sku].unitsSold += item.quantity
      }
    }

    // Calculate derived metrics
    const products = Object.values(productMap).map((p) => {
      p.profit = p.revenue - p.cost
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
      p.averagePrice = p.unitsSold > 0 ? p.revenue / p.unitsSold : 0
      return p
    })

    return products.sort((a, b) => b.profit - a.profit)
  }

  /**
   * Identify products with low margins that need price adjustment
   */
  async identifyLowMarginProducts(minMargin: number = 20): Promise<ProductProfitability[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const products = await this.getProductProfitability(thirtyDaysAgo, new Date())

    return products.filter((p) => p.margin < minMargin && p.unitsSold > 0)
  }

  /**
   * Identify high-profit products to promote
   */
  async identifyHighProfitProducts(minMargin: number = 40): Promise<ProductProfitability[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const products = await this.getProductProfitability(thirtyDaysAgo, new Date())

    return products.filter((p) => p.margin >= minMargin && p.unitsSold > 0)
  }

  /**
   * Calculate profit forecast based on historical data
   */
  async forecastProfit(daysToForecast: number = 30): Promise<{
    forecastedRevenue: number
    forecastedProfit: number
    confidenceLevel: number
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const [recentMetrics, previousMetrics] = await Promise.all([
      this.calculateProfitMetrics(thirtyDaysAgo, new Date()),
      this.calculateProfitMetrics(sixtyDaysAgo, thirtyDaysAgo),
    ])

    // Calculate growth rate
    const revenueGrowth = previousMetrics.revenue > 0
      ? (recentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue
      : 0

    const profitGrowth = previousMetrics.profit > 0
      ? (recentMetrics.profit - previousMetrics.profit) / previousMetrics.profit
      : 0

    // Forecast based on growth rate
    const forecastedRevenue = recentMetrics.revenue * (1 + revenueGrowth)
    const forecastedProfit = recentMetrics.profit * (1 + profitGrowth)

    // Confidence level based on data consistency
    const confidenceLevel = Math.min(
      (recentMetrics.revenue > 1000 ? 0.3 : 0.1) +
      (Math.abs(revenueGrowth) < 0.5 ? 0.4 : 0.2) +
      (recentMetrics.margin > 20 ? 0.3 : 0.2),
      1.0
    ) * 100

    return {
      forecastedRevenue,
      forecastedProfit,
      confidenceLevel,
    }
  }

  /**
   * Calculate optimal price for maximum profit
   */
  calculateOptimalPrice(
    currentPrice: number,
    costPrice: number,
    currentDemand: number,
    priceElasticity: number = -1.5
  ): { optimalPrice: number; expectedProfit: number } {
    const minPrice = costPrice * 1.2 // Minimum 20% margin
    const maxPrice = currentPrice * 1.5 // Don't increase more than 50%

    let optimalPrice = currentPrice
    let maxProfit = (currentPrice - costPrice) * currentDemand

    // Test different price points
    for (let price = minPrice; price <= maxPrice; price += 0.01) {
      const priceChange = (price - currentPrice) / currentPrice
      const demandChange = priceChange * priceElasticity
      const expectedDemand = currentDemand * (1 + demandChange)
      const profit = (price - costPrice) * Math.max(0, expectedDemand)

      if (profit > maxProfit) {
        maxProfit = profit
        optimalPrice = price
      }
    }

    return {
      optimalPrice: Math.round(optimalPrice * 100) / 100,
      expectedProfit: Math.round(maxProfit * 100) / 100,
    }
  }

  /**
   * Analyze profit by platform
   */
  async getProfitByPlatform(startDate: Date, endDate: Date): Promise<Record<string, ProfitMetrics>> {
    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        orderDate: { gte: startDate, lte: endDate },
        status: { in: ["DELIVERED", "SHIPPED"] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    const platformMetrics: Record<string, ProfitMetrics> = {}

    for (const order of orders) {
      const platform = order.platform

      if (!platformMetrics[platform]) {
        platformMetrics[platform] = {
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
          roi: 0,
        }
      }

      platformMetrics[platform].revenue += Number(order.total)

      for (const item of order.items) {
        const itemCost = item.product?.costPrice
          ? Number(item.product.costPrice) * item.quantity
          : Number(item.price) * item.quantity * 0.7

        platformMetrics[platform].cost += itemCost
      }
    }

    // Calculate derived metrics
    for (const platform in platformMetrics) {
      const metrics = platformMetrics[platform]
      metrics.profit = metrics.revenue - metrics.cost
      metrics.margin = metrics.revenue > 0 ? (metrics.profit / metrics.revenue) * 100 : 0
      metrics.roi = metrics.cost > 0 ? (metrics.profit / metrics.cost) * 100 : 0
    }

    return platformMetrics
  }
}
