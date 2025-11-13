import { prisma } from "@/lib/db/client"

export interface CrossSellRecommendation {
  productId: string
  sku: string
  title: string
  recommendedProducts: {
    productId: string
    sku: string
    title: string
    frequency: number
    confidence: number
  }[]
}

export interface BundleRecommendation {
  name: string
  products: {
    productId: string
    sku: string
    title: string
    price: number
  }[]
  individualPrice: number
  bundlePrice: number
  savings: number
  savingsPercentage: number
  expectedConversion: number
}

export class RecommendationEngine {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Generate cross-sell recommendations based on purchase history
   */
  async generateCrossSellRecommendations(): Promise<CrossSellRecommendation[]> {
    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        status: { in: ["DELIVERED", "SHIPPED"] },
      },
      include: {
        items: true,
      },
    })

    // Build co-purchase matrix
    const coPurchaseMap: Record<string, Record<string, number>> = {}

    for (const order of orders) {
      const items = order.items

      // For each pair of items in the order
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const sku1 = items[i].sku
          const sku2 = items[j].sku

          // Track co-purchases
          if (!coPurchaseMap[sku1]) coPurchaseMap[sku1] = {}
          if (!coPurchaseMap[sku2]) coPurchaseMap[sku2] = {}

          coPurchaseMap[sku1][sku2] = (coPurchaseMap[sku1][sku2] || 0) + 1
          coPurchaseMap[sku2][sku1] = (coPurchaseMap[sku2][sku1] || 0) + 1
        }
      }
    }

    // Convert to recommendations
    const recommendations: CrossSellRecommendation[] = []

    for (const sku in coPurchaseMap) {
      const relatedProducts = coPurchaseMap[sku]
      const sortedRelated = Object.entries(relatedProducts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5 related products

      if (sortedRelated.length === 0) continue

      const product = await prisma.product.findUnique({
        where: { sku },
      })

      if (!product) continue

      const recommendedProducts = []
      for (const [relatedSku, frequency] of sortedRelated) {
        const relatedProduct = await prisma.product.findUnique({
          where: { sku: relatedSku },
        })

        if (relatedProduct) {
          recommendedProducts.push({
            productId: relatedProduct.id,
            sku: relatedSku,
            title: relatedProduct.title,
            frequency,
            confidence: Math.min(frequency / orders.length, 1.0),
          })
        }
      }

      recommendations.push({
        productId: product.id,
        sku,
        title: product.title,
        recommendedProducts,
      })
    }

    return recommendations
  }

  /**
   * Generate upsell recommendations (higher-priced alternatives)
   */
  async generateUpsellRecommendations(productId: string): Promise<any[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) return []

    // Find higher-priced products in the same category
    const upsells = await prisma.product.findMany({
      where: {
        userId: this.userId,
        status: "ACTIVE",
        category: product.category,
        price: {
          gt: product.price,
          lte: Number(product.price) * 1.5, // Up to 50% more expensive
        },
        id: { not: productId },
      },
      orderBy: {
        price: "asc",
      },
      take: 3,
    })

    return upsells.map((upsell) => ({
      productId: upsell.id,
      sku: upsell.sku,
      title: upsell.title,
      price: Number(upsell.price),
      priceDifference: Number(upsell.price) - Number(product.price),
      percentageIncrease: ((Number(upsell.price) - Number(product.price)) / Number(product.price)) * 100,
    }))
  }

  /**
   * Generate bundle recommendations for maximum profit
   */
  async generateBundleRecommendations(): Promise<BundleRecommendation[]> {
    const crossSells = await this.generateCrossSellRecommendations()
    const bundles: BundleRecommendation[] = []

    for (const crossSell of crossSells) {
      if (crossSell.recommendedProducts.length < 2) continue

      const mainProduct = await prisma.product.findUnique({
        where: { id: crossSell.productId },
      })

      if (!mainProduct) continue

      // Create bundle with main product and top 2 recommended products
      const bundleProducts = [
        {
          productId: mainProduct.id,
          sku: mainProduct.sku,
          title: mainProduct.title,
          price: Number(mainProduct.price),
        },
      ]

      let totalPrice = Number(mainProduct.price)

      for (const rec of crossSell.recommendedProducts.slice(0, 2)) {
        const product = await prisma.product.findUnique({
          where: { id: rec.productId },
        })

        if (product) {
          bundleProducts.push({
            productId: product.id,
            sku: product.sku,
            title: product.title,
            price: Number(product.price),
          })
          totalPrice += Number(product.price)
        }
      }

      if (bundleProducts.length < 3) continue

      // Bundle discount: 15% off total
      const bundlePrice = totalPrice * 0.85
      const savings = totalPrice - bundlePrice

      bundles.push({
        name: `${mainProduct.title} Bundle`,
        products: bundleProducts,
        individualPrice: totalPrice,
        bundlePrice,
        savings,
        savingsPercentage: 15,
        expectedConversion: crossSell.recommendedProducts[0]?.confidence || 0.5,
      })
    }

    return bundles.sort((a, b) => b.expectedConversion - a.expectedConversion).slice(0, 10)
  }

  /**
   * Recommend products to promote based on profit potential
   */
  async recommendProductsToPromote(): Promise<any[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        orderDate: { gte: thirtyDaysAgo },
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

    const productMetrics: Record<string, any> = {}

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product) continue

        const sku = item.sku
        if (!productMetrics[sku]) {
          productMetrics[sku] = {
            productId: item.product.id,
            sku,
            title: item.title,
            revenue: 0,
            profit: 0,
            unitsSold: 0,
            margin: 0,
            score: 0,
          }
        }

        const revenue = Number(item.price) * item.quantity
        const cost = item.product.costPrice
          ? Number(item.product.costPrice) * item.quantity
          : revenue * 0.7

        productMetrics[sku].revenue += revenue
        productMetrics[sku].profit += revenue - cost
        productMetrics[sku].unitsSold += item.quantity
      }
    }

    // Calculate margin and promotion score
    const products = Object.values(productMetrics).map((p: any) => {
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0

      // Promotion score: high margin + moderate sales volume
      p.score = p.margin * 0.6 + Math.min(p.unitsSold / 10, 10) * 0.4

      return p
    })

    return products
      .filter((p: any) => p.margin > 25 && p.unitsSold > 3)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10)
  }

  /**
   * Calculate expected profit increase from implementing recommendations
   */
  async calculateRecommendationImpact(): Promise<{
    crossSellImpact: number
    bundleImpact: number
    upsellImpact: number
    totalImpact: number
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const orders = await prisma.order.findMany({
      where: {
        userId: this.userId,
        orderDate: { gte: thirtyDaysAgo },
      },
    })

    const currentRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0)

    // Estimate impacts
    const crossSellImpact = currentRevenue * 0.15 // 15% increase from cross-sells
    const bundleImpact = currentRevenue * 0.10 // 10% increase from bundles
    const upsellImpact = currentRevenue * 0.08 // 8% increase from upsells

    return {
      crossSellImpact,
      bundleImpact,
      upsellImpact,
      totalImpact: crossSellImpact + bundleImpact + upsellImpact,
    }
  }
}
