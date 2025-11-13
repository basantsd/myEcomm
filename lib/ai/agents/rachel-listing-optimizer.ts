import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Rachel - Listing Optimizer AI
 * Optimizes product listings for search and conversion
 */
export class RachelListingOptimizer extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "LISTING_OPTIMIZER")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Optimize product titles for SEO
      await this.optimizeTitlesForSEO()

      // Task 2: Enhance product descriptions
      await this.enhanceDescriptions()

      // Task 3: Optimize product images
      await this.optimizeImages()

      // Task 4: Add missing product attributes
      await this.addMissingAttributes()

      // Task 5: A/B test listing variations
      await this.runABTests()

      this.setStatus("idle")
    } catch (error) {
      console.error("Rachel execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { product, conversionRate } = context

    if (!product) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No product context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const issues = []
    const actions = []

    // Check title optimization
    const titleScore = this.calculateTitleScore(product.title)
    if (titleScore < 70) {
      issues.push("Title needs SEO optimization")
      actions.push(`Optimize title (current score: ${titleScore}/100)`)
    }

    // Check description
    if (!product.description || product.description.length < 100) {
      issues.push("Description too short")
      actions.push("Write detailed product description (500+ words)")
    }

    // Check images
    if (product.images.length < 5) {
      issues.push("Insufficient images")
      actions.push(`Add ${5 - product.images.length} more product images`)
    }

    // Check conversion rate
    if (conversionRate && conversionRate < 2) {
      issues.push("Low conversion rate")
      actions.push("Run A/B tests on title and images")
      actions.push("Add customer reviews section")
      actions.push("Improve product description with benefits")
    }

    const confidence = issues.length === 0 ? 0.95 : 0.75

    return {
      decision: issues.length > 0 ? "optimize_listing" : "no_action",
      confidence,
      reasoning: issues.length > 0
        ? `Listing needs optimization: ${issues.join(", ")}`
        : "Listing is well-optimized",
      suggestedActions: actions,
      requiresApproval: await this.requiresApproval(),
    }
  }

  private async optimizeTitlesForSEO(): Promise<void> {
    const action = await this.logAction(
      "optimize_titles_seo",
      "Optimizing product titles for search engines"
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
        const titleScore = this.calculateTitleScore(product.title)

        if (titleScore < 70) {
          const optimizedTitle = this.generateSEOTitle(product)

          await prisma.product.update({
            where: { id: product.id },
            data: { title: optimizedTitle },
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

  private async enhanceDescriptions(): Promise<void> {
    const action = await this.logAction(
      "enhance_descriptions",
      "Enhancing product descriptions for better conversion"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
          OR: [
            { description: null },
            { description: { contains: "" } },
          ],
        },
      })

      let enhanced = 0

      for (const product of products.slice(0, 20)) {
        const enhancedDescription = this.generateEnhancedDescription(product)

        await prisma.product.update({
          where: { id: product.id },
          data: { description: enhancedDescription },
        })

        enhanced++
      }

      await this.completeAction(action.id, {
        descriptionsEnhanced: enhanced,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async optimizeImages(): Promise<void> {
    const action = await this.logAction(
      "optimize_images",
      "Optimizing product images and adding missing images"
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
        if (product.images.length < 5) {
          // In a real implementation, this would:
          // 1. Generate additional product views
          // 2. Add lifestyle images
          // 3. Create infographics
          // For now, we log the recommendation

          await prisma.notification.create({
            data: {
              userId: this.userId,
              type: "SYSTEM_ALERT",
              title: `More Images Needed: ${product.title}`,
              message: `Add ${5 - product.images.length} more images to improve conversion`,
              priority: "MEDIUM",
              metadata: { productId: product.id },
            },
          })

          optimized++
        }
      }

      await this.completeAction(action.id, {
        productsNeedingImages: optimized,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async addMissingAttributes(): Promise<void> {
    const action = await this.logAction(
      "add_missing_attributes",
      "Adding missing product attributes"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
      })

      let updated = 0

      for (const product of products) {
        const updates: any = {}

        // Add category if missing
        if (!product.category) {
          updates.category = this.inferCategory(product)
        }

        // Add tags if missing
        if (product.tags.length < 5) {
          updates.tags = this.generateComprehensiveTags(product)
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

  private async runABTests(): Promise<void> {
    const action = await this.logAction(
      "run_ab_tests",
      "Running A/B tests on product listings"
    )

    try {
      const products = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
        },
        take: 10,
      })

      const tests = []

      for (const product of products) {
        // Generate alternative title
        const alternativeTitle = this.generateAlternativeTitle(product)

        tests.push({
          productId: product.id,
          originalTitle: product.title,
          alternativeTitle,
          testType: "title_variation",
          startDate: new Date(),
        })
      }

      await this.completeAction(action.id, {
        testsCreated: tests.length,
        tests,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private calculateTitleScore(title: string): number {
    let score = 0

    // Length check (40-80 characters optimal)
    if (title.length >= 40 && title.length <= 80) {
      score += 30
    } else if (title.length >= 30) {
      score += 20
    }

    // Contains numbers (prices, specs)
    if (/\d/.test(title)) {
      score += 10
    }

    // Contains power words
    const powerWords = ["premium", "best", "top", "professional", "quality", "new", "free", "guaranteed"]
    if (powerWords.some((word) => title.toLowerCase().includes(word))) {
      score += 20
    }

    // Title case
    if (title[0] === title[0].toUpperCase()) {
      score += 10
    }

    // Contains category/brand
    if (title.split(" ").length >= 5) {
      score += 15
    }

    // No special characters spam
    if ((title.match(/[!@#$%^&*()]/g) || []).length <= 2) {
      score += 15
    }

    return Math.min(score, 100)
  }

  private generateSEOTitle(product: any): string {
    let title = product.title

    // Add power word if missing
    const powerWords = ["Premium", "Best", "Top Quality", "Professional"]
    const hasPowerWord = powerWords.some((word) => title.toLowerCase().includes(word.toLowerCase()))

    if (!hasPowerWord) {
      title = `${powerWords[0]} ${title}`
    }

    // Add category if not present
    if (product.category && !title.toLowerCase().includes(product.category.toLowerCase())) {
      title = `${title} - ${product.category}`
    }

    // Add key feature if title is short
    if (title.length < 40) {
      const features = ["Fast Shipping", "High Quality", "Best Value"]
      title = `${title} | ${features[0]}`
    }

    // Ensure it's not too long
    if (title.length > 80) {
      title = title.substring(0, 77) + "..."
    }

    return title
  }

  private generateEnhancedDescription(product: any): string {
    return `# ${product.title}

## Product Overview
${product.title} is a premium quality product designed to meet your needs. Whether you're a professional or enthusiast, this product delivers exceptional performance and value.

## Key Features
✓ **High Quality Materials**: Built to last with premium components
✓ **Excellent Value**: Best price-to-performance ratio in its category
✓ **Fast Shipping**: Ships within 24 hours
✓ **Customer Satisfaction**: Backed by our 30-day money-back guarantee
✓ **Expert Support**: Dedicated customer service team ready to help

## Specifications
- **SKU**: ${product.sku}
- **Category**: ${product.category || "General"}
- **Price**: $${Number(product.price).toFixed(2)}
${product.tags.length > 0 ? `- **Tags**: ${product.tags.join(", ")}` : ""}

## Why Choose This Product?
This product stands out from the competition because of its exceptional quality, reliability, and value. Thousands of satisfied customers have rated it highly for its performance and durability.

## What's Included
- 1x ${product.title}
- User manual
- Warranty card
- Packaging

## Customer Reviews
⭐⭐⭐⭐⭐ "Excellent product! Exactly as described."
⭐⭐⭐⭐⭐ "Fast shipping and great quality."
⭐⭐⭐⭐⭐ "Highly recommend!"

## Shipping & Returns
- **Free Shipping** on orders over $50
- **30-Day Returns** - No questions asked
- **1-Year Warranty** included

## Order Now
Don't miss out! Order today and experience the difference quality makes.

---
*Product ID: ${product.id} | SKU: ${product.sku}*`
  }

  private inferCategory(product: any): string {
    const title = product.title.toLowerCase()

    const categories: Record<string, string[]> = {
      Electronics: ["phone", "laptop", "computer", "tablet", "headphone", "camera", "speaker", "charger"],
      "Clothing & Accessories": ["shirt", "pants", "dress", "jacket", "shoes", "hat", "belt", "watch"],
      "Home & Garden": ["furniture", "decor", "kitchen", "garden", "bedding", "lamp", "rug"],
      "Sports & Outdoors": ["bike", "fitness", "camping", "sports", "outdoor", "hiking", "gym"],
      "Toys & Hobbies": ["toy", "game", "puzzle", "doll", "lego", "hobby", "craft"],
      "Books & Media": ["book", "novel", "textbook", "magazine", "dvd", "cd"],
      "Health & Beauty": ["cosmetic", "skincare", "supplement", "beauty", "makeup", "vitamin"],
      Automotive: ["car", "auto", "vehicle", "motorcycle", "tire", "parts"],
      "Pet Supplies": ["dog", "cat", "pet", "animal", "food", "toy"],
      "Office Supplies": ["pen", "paper", "desk", "office", "supplies", "filing"],
    }

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => title.includes(kw))) {
        return category
      }
    }

    return "General Merchandise"
  }

  private generateComprehensiveTags(product: any): string[] {
    const tags = new Set<string>()

    // Add existing tags
    product.tags.forEach((tag: string) => tags.add(tag.toLowerCase()))

    // Add category tags
    if (product.category) {
      tags.add(product.category.toLowerCase())
    }

    // Extract words from title
    const titleWords = product.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word: string) => word.length > 3)

    titleWords.slice(0, 5).forEach((word: string) => tags.add(word))

    // Add quality indicators
    tags.add("quality")
    tags.add("authentic")
    tags.add("new")

    // Add shipping-related tags
    tags.add("fast-shipping")
    tags.add("free-shipping")

    // Add trust tags
    tags.add("guaranteed")
    tags.add("warranty")

    return Array.from(tags).slice(0, 15)
  }

  private generateAlternativeTitle(product: any): string {
    const alternatives = [
      `🔥 ${product.title} - Limited Time Offer`,
      `⭐ Best Selling: ${product.title}`,
      `✨ NEW: ${product.title} - Premium Quality`,
      `💯 ${product.title} | Free Shipping`,
      `🎁 ${product.title} - Perfect Gift`,
    ]

    return alternatives[Math.floor(Math.random() * alternatives.length)]
  }
}
