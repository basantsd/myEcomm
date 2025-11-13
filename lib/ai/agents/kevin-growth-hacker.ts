import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Kevin - Growth Hacker AI
 * Identifies growth opportunities and scaling strategies
 */
export class KevinGrowthHacker extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "GROWTH_HACKER")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Identify growth opportunities
      await this.identifyGrowthOpportunities()

      // Task 2: Recommend new platforms
      await this.recommendNewPlatforms()

      // Task 3: Analyze market expansion potential
      await this.analyzeMarketExpansion()

      // Task 4: Optimize conversion funnels
      await this.optimizeConversionFunnels()

      // Task 5: Generate scaling strategies
      await this.generateScalingStrategies()

      this.setStatus("idle")
    } catch (error) {
      console.error("Kevin execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { revenue, growth, platformCount } = context

    if (!revenue) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No revenue data provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.8

    if (growth > 50) {
      decision = "aggressive_scaling"
      actions.push("🚀 Scale up operations immediately")
      actions.push("Expand to 3+ new platforms")
      actions.push("Increase marketing budget by 100%")
      actions.push("Hire additional support staff")
      actions.push("Invest in automation tools")
      confidence = 0.95
    } else if (growth > 20) {
      decision = "moderate_scaling"
      actions.push("📈 Steady growth - time to scale")
      actions.push("Add 1-2 new sales platforms")
      actions.push("Increase inventory by 50%")
      actions.push("Boost ad spend on top performers")
      confidence = 0.9
    } else if (growth < 0) {
      decision = "pivot_strategy"
      actions.push("⚠️ Negative growth detected")
      actions.push("Analyze what's not working")
      actions.push("Test new product categories")
      actions.push("Launch aggressive promotions")
      actions.push("Reevaluate pricing strategy")
      confidence = 0.85
    } else if (platformCount < 3) {
      decision = "expand_platforms"
      actions.push("Expand to more platforms")
      actions.push("Currently on only " + platformCount + " platforms")
      actions.push("Recommend adding Amazon, eBay, or Etsy")
      confidence = 0.8
    }

    return {
      decision,
      confidence,
      reasoning: growth > 0
        ? `Strong ${growth.toFixed(1)}% growth - ready to scale`
        : `Declining ${Math.abs(growth).toFixed(1)}% - need strategy pivot`,
      suggestedActions: actions,
      requiresApproval: decision === "aggressive_scaling" || await this.requiresApproval(),
    }
  }

  private async identifyGrowthOpportunities(): Promise<void> {
    const action = await this.logAction(
      "identify_growth_opportunities",
      "Identifying high-potential growth opportunities"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const [orders, products, connections] = await Promise.all([
        prisma.order.findMany({
          where: {
            userId: this.userId,
            orderDate: { gte: thirtyDaysAgo },
          },
          include: { items: true },
        }),
        prisma.product.findMany({
          where: {
            userId: this.userId,
            status: "ACTIVE",
          },
        }),
        prisma.platformConnection.findMany({
          where: { userId: this.userId },
        }),
      ])

      const opportunities = []

      // Opportunity 1: Untapped platforms
      const totalPlatforms = 22 // From our platform configs
      const connectedPlatforms = connections.length
      if (connectedPlatforms < 5) {
        opportunities.push({
          type: "platform_expansion",
          title: "🌐 Expand to More Platforms",
          description: `You're on ${connectedPlatforms} platforms. Add ${Math.min(5 - connectedPlatforms, 3)} more to reach wider audience`,
          impact: "HIGH",
          effort: "MEDIUM",
          potentialRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0) * 0.5,
        })
      }

      // Opportunity 2: Top performing products
      const productSales = this.calculateProductPerformance(orders)
      const topProducts = productSales.slice(0, 3)

      if (topProducts.length > 0 && topProducts[0].revenue > 1000) {
        opportunities.push({
          type: "product_scaling",
          title: "⭐ Scale Top Performers",
          description: `Your top product generated $${topProducts[0].revenue.toFixed(2)}. Increase inventory and marketing.`,
          impact: "HIGH",
          effort: "LOW",
          potentialRevenue: topProducts[0].revenue * 0.3,
        })
      }

      // Opportunity 3: Underutilized inventory
      const slowMovingProducts = products.filter((p) => p.quantity > 50).length
      if (slowMovingProducts > 0) {
        opportunities.push({
          type: "inventory_liquidation",
          title: "💰 Liquidate Slow Inventory",
          description: `${slowMovingProducts} products with excess stock. Flash sale could generate quick cash.`,
          impact: "MEDIUM",
          effort: "LOW",
          potentialRevenue: slowMovingProducts * 100,
        })
      }

      // Opportunity 4: Cross-selling
      if (products.length > 10) {
        opportunities.push({
          type: "cross_selling",
          title: "🔗 Implement Cross-Selling",
          description: "Bundle related products to increase average order value by 20-30%",
          impact: "MEDIUM",
          effort: "MEDIUM",
          potentialRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0) * 0.25,
        })
      }

      // Opportunity 5: International expansion
      const domesticOnly = connections.every((c) => !c.metadata || !c.metadata.international)
      if (domesticOnly && orders.length > 20) {
        opportunities.push({
          type: "international_expansion",
          title: "🌍 Go International",
          description: "Expand to international markets for 40%+ revenue increase",
          impact: "VERY_HIGH",
          effort: "HIGH",
          potentialRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0) * 0.4,
        })
      }

      // Create notifications for top opportunities
      for (const opportunity of opportunities.slice(0, 3)) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: opportunity.title,
            message: `${opportunity.description} | Impact: ${opportunity.impact} | Potential: $${opportunity.potentialRevenue.toFixed(0)}`,
            priority: opportunity.impact === "VERY_HIGH" || opportunity.impact === "HIGH" ? "HIGH" : "MEDIUM",
            metadata: opportunity,
          },
        })
      }

      await this.completeAction(action.id, {
        opportunitiesIdentified: opportunities.length,
        totalPotentialRevenue: opportunities.reduce((sum, o) => sum + o.potentialRevenue, 0),
        opportunities,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async recommendNewPlatforms(): Promise<void> {
    const action = await this.logAction(
      "recommend_new_platforms",
      "Recommending optimal new platforms to expand to"
    )

    try {
      const connections = await prisma.platformConnection.findMany({
        where: { userId: this.userId },
      })

      const connectedPlatforms = connections.map((c) => c.platform)

      // Platform recommendations based on business type
      const platformRecommendations = [
        {
          platform: "AMAZON",
          connected: connectedPlatforms.includes("AMAZON"),
          priority: "CRITICAL",
          reason: "Largest marketplace - 50% of e-commerce",
          estimatedRevenue: 50000,
        },
        {
          platform: "EBAY",
          connected: connectedPlatforms.includes("EBAY"),
          priority: "HIGH",
          reason: "Great for unique/used items - 182M buyers",
          estimatedRevenue: 25000,
        },
        {
          platform: "ETSY",
          connected: connectedPlatforms.includes("ETSY"),
          priority: "HIGH",
          reason: "Perfect for handmade/vintage - engaged buyers",
          estimatedRevenue: 20000,
        },
        {
          platform: "WALMART",
          connected: connectedPlatforms.includes("WALMART"),
          priority: "MEDIUM",
          reason: "Growing marketplace - 150M monthly visitors",
          estimatedRevenue: 30000,
        },
        {
          platform: "GOOGLE_SHOPPING",
          connected: connectedPlatforms.includes("GOOGLE_SHOPPING"),
          priority: "HIGH",
          reason: "Show up in Google search results",
          estimatedRevenue: 15000,
        },
      ]

      const recommendations = platformRecommendations
        .filter((p) => !p.connected)
        .sort((a, b) => {
          const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
          return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
        })

      await this.completeAction(action.id, {
        recommendationsCount: recommendations.length,
        totalPotentialRevenue: recommendations.reduce((sum, r) => sum + r.estimatedRevenue, 0),
        recommendations: recommendations.slice(0, 3),
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async analyzeMarketExpansion(): Promise<void> {
    const action = await this.logAction(
      "analyze_market_expansion",
      "Analyzing potential for market expansion"
    )

    try {
      const [orders, products] = await Promise.all([
        prisma.order.findMany({
          where: { userId: this.userId },
        }),
        prisma.product.findMany({
          where: { userId: this.userId, status: "ACTIVE" },
        }),
      ])

      const analysis = {
        currentMarketSize: orders.length,
        productCatalogSize: products.length,
        readinessScore: this.calculateExpansionReadiness(orders, products),
        recommendations: [] as string[],
      }

      if (analysis.readinessScore > 70) {
        analysis.recommendations.push("✅ Ready for aggressive expansion")
        analysis.recommendations.push("Add 3+ new platforms")
        analysis.recommendations.push("Consider international markets")
      } else if (analysis.readinessScore > 40) {
        analysis.recommendations.push("⚠️ Moderate readiness - start with 1-2 platforms")
        analysis.recommendations.push("Optimize current operations first")
      } else {
        analysis.recommendations.push("❌ Focus on current channels before expanding")
        analysis.recommendations.push("Build solid foundation first")
      }

      await this.completeAction(action.id, analysis)
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async optimizeConversionFunnels(): Promise<void> {
    const action = await this.logAction(
      "optimize_conversion_funnels",
      "Optimizing conversion funnels for growth"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
      })

      const optimizations = []

      for (const product of products.slice(0, 10)) {
        const issues = []

        // Check for conversion blockers
        if (product.images.length < 3) {
          issues.push("Add more product images")
        }

        if (!product.description || product.description.length < 100) {
          issues.push("Write detailed description")
        }

        if (product.tags.length < 5) {
          issues.push("Add more search tags")
        }

        if (issues.length > 0) {
          optimizations.push({
            productId: product.id,
            title: product.title,
            issues,
            estimatedConversionLift: issues.length * 5, // 5% per fix
          })
        }
      }

      await this.completeAction(action.id, {
        productsAnalyzed: products.length,
        productsNeedingOptimization: optimizations.length,
        averageLiftPotential: optimizations.length > 0
          ? optimizations.reduce((sum, o) => sum + o.estimatedConversionLift, 0) / optimizations.length
          : 0,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async generateScalingStrategies(): Promise<void> {
    const action = await this.logAction(
      "generate_scaling_strategies",
      "Generating comprehensive scaling strategies"
    )

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

      const [currentPeriod, previousPeriod, products, connections] = await Promise.all([
        prisma.order.findMany({
          where: { userId: this.userId, orderDate: { gte: thirtyDaysAgo } },
        }),
        prisma.order.findMany({
          where: { userId: this.userId, orderDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        }),
        prisma.product.findMany({
          where: { userId: this.userId, status: "ACTIVE" },
        }),
        prisma.platformConnection.findMany({
          where: { userId: this.userId },
        }),
      ])

      const currentRevenue = currentPeriod.reduce((sum, o) => sum + Number(o.total), 0)
      const previousRevenue = previousPeriod.reduce((sum, o) => sum + Number(o.total), 0)
      const growthRate = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0

      const strategies = []

      // Strategy based on growth rate
      if (growthRate > 30) {
        strategies.push({
          title: "🚀 Aggressive Scaling Phase",
          tactics: [
            "Expand to 5+ new platforms immediately",
            "Triple marketing budget",
            "Hire virtual assistants for operations",
            "Invest in automation tools",
            "Increase inventory by 200%",
          ],
          timeline: "30 days",
          expectedROI: "3-5x",
        })
      } else if (growthRate > 10) {
        strategies.push({
          title: "📈 Steady Growth Phase",
          tactics: [
            "Add 2-3 new platforms",
            "Increase marketing by 50%",
            "Optimize top 20% of products",
            "Implement email marketing",
            "Start loyalty program",
          ],
          timeline: "60 days",
          expectedROI: "2-3x",
        })
      } else {
        strategies.push({
          title: "🔧 Optimization Phase",
          tactics: [
            "Fix conversion bottlenecks",
            "Improve product listings",
            "Test new pricing strategies",
            "Launch promotional campaigns",
            "Analyze and pivot underperformers",
          ],
          timeline: "90 days",
          expectedROI: "1.5-2x",
        })
      }

      // Platform diversification strategy
      if (connections.length < 3) {
        strategies.push({
          title: "🌐 Platform Diversification",
          tactics: [
            "Risk mitigation through multi-platform presence",
            "Target: 5+ platforms within 6 months",
            "Start with highest-traffic platforms",
          ],
          timeline: "180 days",
          expectedROI: "2-4x",
        })
      }

      // Create notification with top strategy
      if (strategies.length > 0) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: `💡 Growth Strategy: ${strategies[0].title}`,
            message: `Current growth: ${growthRate.toFixed(1)}%. ${strategies[0].tactics[0]}`,
            priority: "HIGH",
            metadata: strategies[0],
          },
        })
      }

      await this.completeAction(action.id, {
        strategiesGenerated: strategies.length,
        currentGrowthRate: growthRate.toFixed(2) + "%",
        recommendedStrategy: strategies[0]?.title,
        strategies,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private calculateProductPerformance(orders: any[]): any[] {
    const productMap: Record<string, any> = {}

    for (const order of orders) {
      for (const item of order.items) {
        if (!productMap[item.sku]) {
          productMap[item.sku] = {
            sku: item.sku,
            title: item.title,
            orders: 0,
            quantity: 0,
            revenue: 0,
          }
        }

        productMap[item.sku].orders += 1
        productMap[item.sku].quantity += item.quantity
        productMap[item.sku].revenue += Number(item.price) * item.quantity
      }
    }

    return Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
  }

  private calculateExpansionReadiness(orders: any[], products: any[]): number {
    let score = 0

    // Factor 1: Order volume (max 30 points)
    if (orders.length > 100) score += 30
    else if (orders.length > 50) score += 20
    else if (orders.length > 20) score += 10

    // Factor 2: Product catalog (max 25 points)
    if (products.length > 50) score += 25
    else if (products.length > 20) score += 15
    else if (products.length > 10) score += 10

    // Factor 3: Revenue consistency (max 25 points)
    if (orders.length > 30) score += 25
    else if (orders.length > 15) score += 15

    // Factor 4: Product quality (max 20 points)
    const wellOptimized = products.filter(
      (p) => p.description && p.images.length >= 3 && p.tags.length >= 5
    ).length
    const optimizationRate = products.length > 0 ? wellOptimized / products.length : 0
    score += Math.floor(optimizationRate * 20)

    return Math.min(score, 100)
  }
}
