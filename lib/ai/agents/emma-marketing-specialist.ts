import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Emma - Marketing Specialist AI
 * Creates promotions and optimizes product visibility
 */
export class EmmaMarketingSpecialist extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "MARKETING_SPECIALIST")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Create promotional campaigns
      await this.createPromotions()

      // Task 2: Optimize product visibility
      await this.optimizeProductVisibility()

      // Task 3: Generate marketing content
      await this.generateMarketingContent()

      // Task 4: Analyze campaign performance
      await this.analyzeCampaignPerformance()

      this.setStatus("idle")
    } catch (error) {
      console.error("Emma execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { product, salesData } = context

    if (!product) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No product context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const daysSinceListed = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    const hasHighInventory = product.quantity > 30

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.8

    if (daysSinceListed > 30 && hasHighInventory) {
      decision = "create_promotion"
      actions.push("Create 20% off promotion")
      actions.push("Boost product visibility on platforms")
      actions.push("Send email campaign to past customers")
      actions.push("Create social media posts")
      confidence = 0.85
    } else if (daysSinceListed < 7) {
      decision = "boost_new_product"
      actions.push("Feature as 'New Arrival'")
      actions.push("Increase ad spend for this product")
      actions.push("Create product showcase post")
      confidence = 0.9
    } else if (product.quantity > 50) {
      decision = "clearance_sale"
      actions.push("Create clearance sale promotion")
      actions.push("Bundle with related products")
      actions.push("Offer buy-one-get-one deals")
      confidence = 0.8
    }

    return {
      decision,
      confidence,
      reasoning: daysSinceListed > 30
        ? `Product is ${Math.floor(daysSinceListed)} days old with high inventory - needs promotion`
        : daysSinceListed < 7
        ? "New product - opportunity to boost visibility"
        : hasHighInventory
        ? "High inventory - create clearance promotion"
        : "Product marketing is on track",
      suggestedActions: actions,
      requiresApproval: await this.requiresApproval(),
    }
  }

  private async createPromotions(): Promise<void> {
    const action = await this.logAction(
      "create_promotions",
      "Creating promotional campaigns"
    )

    try {
      const config = await this.getConfig()
      const promotionFrequency = config.promotionFrequency || "weekly"

      // Find products suitable for promotion
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
          quantity: { gte: 20 },
        },
      })

      // Select top candidates for promotion
      const promotionCandidates = this.selectPromotionCandidates(products, 5)

      let created = 0

      for (const product of promotionCandidates) {
        const discountPercentage = this.calculateOptimalDiscount(product)

        await prisma.promotion.create({
          data: {
            userId: this.userId,
            productId: product.id,
            title: `${discountPercentage}% Off - ${product.title}`,
            discountPercentage,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            status: "active",
          },
        })

        // Update product with promotion tag
        await prisma.product.update({
          where: { id: product.id },
          data: {
            tags: [...new Set([...product.tags, "sale", "promotion"])],
          },
        })

        created++
      }

      await this.completeAction(action.id, {
        promotionsCreated: created,
        candidatesEvaluated: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async optimizeProductVisibility(): Promise<void> {
    const action = await this.logAction(
      "optimize_visibility",
      "Optimizing product visibility and search rankings"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
      })

      let optimized = 0

      for (const product of products) {
        const improvements: any = {}

        // Optimize tags for search
        if (product.tags.length < 5) {
          improvements.tags = this.generateSearchOptimizedTags(product)
        }

        // Optimize title if needed
        if (!this.hasSearchKeywords(product.title)) {
          improvements.title = this.optimizeTitleForSearch(product)
        }

        if (Object.keys(improvements).length > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: improvements,
          })
          optimized++
        }
      }

      await this.completeAction(action.id, {
        productsOptimized: optimized,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async generateMarketingContent(): Promise<void> {
    const action = await this.logAction(
      "generate_marketing_content",
      "Generating marketing content for products"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
        take: 10,
      })

      let generated = 0

      for (const product of products) {
        const content = this.generateProductMarketingContent(product)

        await prisma.marketingContent.create({
          data: {
            userId: this.userId,
            productId: product.id,
            contentType: "product_description",
            title: `Marketing Copy: ${product.title}`,
            content,
            status: "draft",
          },
        })

        generated++
      }

      await this.completeAction(action.id, {
        contentGenerated: generated,
        productsProcessed: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async analyzeCampaignPerformance(): Promise<void> {
    const action = await this.logAction(
      "analyze_campaigns",
      "Analyzing marketing campaign performance"
    )

    try {
      const promotions = await prisma.promotion.findMany({
        where: {
          userId: this.userId,
          status: "active",
        },
        include: {
          product: true,
        },
      })

      const analysis = promotions.map((promo) => ({
        promotionId: promo.id,
        productTitle: promo.product.title,
        discountPercentage: promo.discountPercentage,
        daysActive: Math.floor(
          (Date.now() - new Date(promo.startDate).getTime()) / (1000 * 60 * 60 * 24)
        ),
        // In a real implementation, would calculate actual conversion metrics
        estimatedConversions: Math.floor(Math.random() * 20),
        roi: (Math.random() * 200 + 50).toFixed(1), // Simulated ROI %
      }))

      await this.completeAction(action.id, {
        campaignsAnalyzed: promotions.length,
        analysis,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private selectPromotionCandidates(products: any[], count: number): any[] {
    // Prioritize:
    // 1. High inventory (>30 units)
    // 2. Older products (>30 days)
    // 3. No recent promotions

    return products
      .map((p) => ({
        ...p,
        score:
          (p.quantity > 30 ? 10 : 0) +
          (Date.now() - new Date(p.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000 ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  }

  private calculateOptimalDiscount(product: any): number {
    const daysSinceListed = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceListed > 60) return 25
    if (daysSinceListed > 30) return 20
    if (product.quantity > 50) return 20
    return 15
  }

  private generateSearchOptimizedTags(product: any): string[] {
    const tags = [...product.tags]

    // Add category-based tags
    if (product.category) {
      tags.push(product.category.toLowerCase())
    }

    // Add feature-based tags
    const featureTags = ["bestseller", "trending", "popular", "top-rated", "recommended"]
    tags.push(featureTags[Math.floor(Math.random() * featureTags.length)])

    // Add condition tags
    tags.push("new", "authentic", "quality")

    return [...new Set(tags)]
  }

  private hasSearchKeywords(title: string): boolean {
    const keywords = ["premium", "best", "top", "professional", "quality", "new"]
    return keywords.some((kw) => title.toLowerCase().includes(kw))
  }

  private optimizeTitleForSearch(product: any): string {
    let optimized = product.title

    // Add power words
    const powerWords = ["Premium", "Best", "Top Quality", "Professional"]
    const selectedWord = powerWords[Math.floor(Math.random() * powerWords.length)]

    if (!this.hasSearchKeywords(optimized)) {
      optimized = `${selectedWord} ${optimized}`
    }

    // Add key features if title is short
    if (optimized.length < 40 && product.category) {
      optimized = `${optimized} - ${product.category}`
    }

    return optimized.slice(0, 80)
  }

  private generateProductMarketingContent(product: any): string {
    return `🎉 Introducing: ${product.title}

${this.generateHookLine(product)}

✨ Why You'll Love It:
${this.generateBenefitsList(product)}

💰 Special Offer: Get ${product.price < 50 ? "10" : "15"}% off when you order today!

🚚 Fast & Free Shipping on orders over $50
🔒 100% Satisfaction Guaranteed
⭐ Trusted by thousands of happy customers

Don't miss out! Limited stock available.

👉 Shop Now: [Product Link]

#${product.category || "Shopping"} #Deal #Sale #LimitedTimeOffer`
  }

  private generateHookLine(product: any): string {
    const hooks = [
      `Experience the difference with our ${product.title}!`,
      `Transform your life with this must-have ${product.category || "product"}!`,
      `Discover why everyone's talking about ${product.title}!`,
      `Get ready to upgrade with our premium ${product.title}!`,
    ]

    return hooks[Math.floor(Math.random() * hooks.length)]
  }

  private generateBenefitsList(product: any): string {
    const benefits = [
      "✓ Premium quality materials",
      "✓ Exceptional durability and performance",
      "✓ Stylish design that stands out",
      "✓ Perfect for everyday use",
      "✓ Makes an excellent gift",
    ]

    return benefits.join("\n")
  }
}
