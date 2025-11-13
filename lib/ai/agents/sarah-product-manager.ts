import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"
import { ProductSyncEngine } from "@/lib/sync/product-sync"

/**
 * Sarah - Product Manager AI
 * Manages product listings, titles, descriptions, and catalog organization
 */
export class SarahProductManager extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "PRODUCT_MANAGER")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Optimize product titles
      await this.optimizeProductTitles()

      // Task 2: Add missing product information
      await this.addMissingProductInfo()

      // Task 3: Categorize uncategorized products
      await this.categorizeProducts()

      // Task 4: Sync products to platforms
      await this.syncProductsToPlatforms()

      this.setStatus("idle")
    } catch (error) {
      console.error("Sarah execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { product } = context

    if (!product) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No product context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const issues: string[] = []
    const actions: string[] = []

    // Check title quality
    if (product.title.length < 20) {
      issues.push("Title too short")
      actions.push("Enhance product title with key features")
    }

    // Check description
    if (!product.description || product.description.length < 50) {
      issues.push("Missing or poor description")
      actions.push("Generate comprehensive product description")
    }

    // Check images
    if (product.images.length < 3) {
      issues.push("Insufficient product images")
      actions.push("Request additional product images")
    }

    // Check category
    if (!product.category) {
      issues.push("Product not categorized")
      actions.push("Categorize product based on title and description")
    }

    const confidence = issues.length === 0 ? 0.9 : 0.7

    return {
      decision: issues.length > 0 ? "optimize_product" : "no_action",
      confidence,
      reasoning: issues.length > 0
        ? `Product needs optimization: ${issues.join(", ")}`
        : "Product listing is well-optimized",
      suggestedActions: actions,
      requiresApproval: await this.requiresApproval(),
    }
  }

  private async optimizeProductTitles(): Promise<void> {
    const action = await this.logAction(
      "optimize_titles",
      "Optimizing product titles for better searchability"
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
        // Check if title needs optimization
        if (product.title.length < 30 || !this.hasKeywords(product.title)) {
          const enhancedTitle = this.enhanceTitle(product)

          await prisma.product.update({
            where: { id: product.id },
            data: { title: enhancedTitle },
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

  private async addMissingProductInfo(): Promise<void> {
    const action = await this.logAction(
      "add_missing_info",
      "Adding missing product information"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
          OR: [
            { description: null },
            { category: null },
            { tags: { isEmpty: true } },
          ],
        },
      })

      let updated = 0

      for (const product of products) {
        const updates: any = {}

        if (!product.description) {
          updates.description = this.generateDescription(product)
        }

        if (!product.category) {
          updates.category = this.inferCategory(product)
        }

        if (product.tags.length === 0) {
          updates.tags = this.generateTags(product)
        }

        if (Object.keys(updates).length > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: updates,
          })
          updated++
        }
      }

      await this.completeAction(action.id, {
        productsUpdated: updated,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async categorizeProducts(): Promise<void> {
    const action = await this.logAction(
      "categorize_products",
      "Categorizing uncategorized products"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
          category: null,
        },
      })

      for (const product of products) {
        const category = this.inferCategory(product)

        await prisma.product.update({
          where: { id: product.id },
          data: { category },
        })
      }

      await this.completeAction(action.id, {
        productsCategorized: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async syncProductsToPlatforms(): Promise<void> {
    const action = await this.logAction(
      "sync_products",
      "Syncing products to connected platforms"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
        include: {
          platformListings: true,
        },
      })

      const connections = await prisma.platformConnection.findMany({
        where: { userId: this.userId },
      })

      if (connections.length === 0) {
        await this.completeAction(action.id, {
          message: "No platforms connected",
        })
        return
      }

      const syncEngine = new ProductSyncEngine(this.userId)
      let synced = 0

      for (const product of products) {
        // Only sync if product hasn't been synced to all platforms
        const syncedPlatforms = product.platformListings.map((l) => l.platform)
        const platforms = connections
          .map((c) => c.platform)
          .filter((p) => !syncedPlatforms.includes(p))

        if (platforms.length > 0) {
          await syncEngine.syncProduct(product.id, platforms)
          synced++
        }
      }

      await this.completeAction(action.id, {
        productsSynced: synced,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private hasKeywords(title: string): boolean {
    const keywords = ["new", "premium", "quality", "professional", "best"]
    return keywords.some((kw) => title.toLowerCase().includes(kw))
  }

  private enhanceTitle(product: any): string {
    // Add keywords and improve title structure
    let enhanced = product.title

    // Capitalize first letter
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1)

    // Add quality indicators if not present
    if (!this.hasKeywords(enhanced)) {
      enhanced = `Premium ${enhanced}`
    }

    // Add SKU if title is too short
    if (enhanced.length < 30) {
      enhanced = `${enhanced} - ${product.sku}`
    }

    return enhanced.slice(0, 80) // Limit to 80 characters
  }

  private generateDescription(product: any): string {
    return `${product.title}

This high-quality product offers excellent value and reliability. Perfect for both personal and professional use.

Key Features:
- SKU: ${product.sku}
- Quality guaranteed
- Fast shipping available

${product.category ? `Category: ${product.category}` : ""}
${product.tags.length > 0 ? `Tags: ${product.tags.join(", ")}` : ""}
    `.trim()
  }

  private inferCategory(product: any): string {
    const title = product.title.toLowerCase()

    const categories: Record<string, string[]> = {
      Electronics: ["phone", "laptop", "computer", "tablet", "headphone", "camera"],
      Clothing: ["shirt", "pants", "dress", "jacket", "shoes", "hat"],
      "Home & Garden": ["furniture", "decor", "kitchen", "garden", "bedding"],
      "Sports & Outdoors": ["bike", "fitness", "camping", "sports", "outdoor"],
      "Toys & Games": ["toy", "game", "puzzle", "doll", "action figure"],
      Books: ["book", "novel", "textbook", "magazine"],
      "Health & Beauty": ["cosmetic", "skincare", "supplement", "beauty"],
      Automotive: ["car", "auto", "vehicle", "motorcycle", "tire"],
    }

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => title.includes(kw))) {
        return category
      }
    }

    return "General"
  }

  private generateTags(product: any): string[] {
    const tags: string[] = []

    // Add category as tag
    if (product.category) {
      tags.push(product.category.toLowerCase())
    }

    // Extract words from title
    const words = product.title.toLowerCase().split(/\s+/)
    const relevantWords = words.filter((w) => w.length > 4)
    tags.push(...relevantWords.slice(0, 3))

    // Add condition tag
    tags.push("new")

    return [...new Set(tags)] // Remove duplicates
  }
}
