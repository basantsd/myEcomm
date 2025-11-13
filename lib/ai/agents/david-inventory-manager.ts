import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"

/**
 * David - Inventory Manager AI
 * Monitors stock levels and prevents overselling
 */
export class DavidInventoryManager extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "INVENTORY_MANAGER")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Check low stock items
      await this.checkLowStock()

      // Task 2: Sync inventory across platforms
      await this.syncInventory()

      // Task 3: Prevent overselling
      await this.preventOverselling()

      // Task 4: Reorder recommendations
      await this.generateReorderRecommendations()

      this.setStatus("idle")
    } catch (error) {
      console.error("David execution error:", error)
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

    const config = await this.getConfig()
    const lowStockThreshold = config.lowStockThreshold || 10
    const criticalStockThreshold = config.criticalStockThreshold || 5

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.9

    if (product.quantity === 0) {
      decision = "mark_out_of_stock"
      actions.push("Mark product as out of stock on all platforms")
      actions.push("Notify supplier for restock")
      actions.push("Update estimated restock date")
      confidence = 1.0
    } else if (product.quantity <= criticalStockThreshold) {
      decision = "critical_reorder"
      actions.push(`URGENT: Order ${this.calculateReorderQuantity(product)} units immediately`)
      actions.push("Limit sales to prevent overselling")
      actions.push("Increase price by 10% due to scarcity")
      confidence = 0.95
    } else if (product.quantity <= lowStockThreshold) {
      decision = "reorder_stock"
      actions.push(`Order ${this.calculateReorderQuantity(product)} units`)
      actions.push("Set low stock warning on platforms")
      confidence = 0.85
    }

    return {
      decision,
      confidence,
      reasoning: product.quantity === 0
        ? "Product is out of stock"
        : product.quantity <= criticalStockThreshold
        ? `Critical stock level: only ${product.quantity} units remaining`
        : product.quantity <= lowStockThreshold
        ? `Low stock: ${product.quantity} units remaining`
        : `Stock level is healthy: ${product.quantity} units`,
      suggestedActions: actions,
      requiresApproval: product.quantity <= criticalStockThreshold || await this.requiresApproval(),
    }
  }

  private async checkLowStock(): Promise<void> {
    const action = await this.logAction(
      "check_low_stock",
      "Checking for low stock items"
    )

    try {
      const config = await this.getConfig()
      const threshold = config.lowStockThreshold || 10

      const syncEngine = new InventorySyncEngine(this.userId)
      const lowStockItems = await syncEngine.checkLowStock(threshold)

      // Create notifications for low stock items
      for (const item of lowStockItems) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "LOW_STOCK",
            title: `Low Stock Alert: ${item.title}`,
            message: `Product "${item.title}" (SKU: ${item.sku}) has only ${item.quantity} units left`,
            priority: item.quantity <= 5 ? "high" : "medium",
            metadata: { productId: item.productId },
          },
        })
      }

      await this.completeAction(action.id, {
        lowStockItems: lowStockItems.length,
        notificationsCreated: lowStockItems.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async syncInventory(): Promise<void> {
    const action = await this.logAction(
      "sync_inventory",
      "Syncing inventory across all platforms"
    )

    try {
      const connections = await prisma.platformConnection.findMany({
        where: { userId: this.userId },
      })

      if (connections.length === 0) {
        await this.completeAction(action.id, {
          message: "No platforms connected",
        })
        return
      }

      const syncEngine = new InventorySyncEngine(this.userId)
      const platforms = connections.map((c) => c.platform)

      const results = await syncEngine.importInventory(platforms)

      const successful = results.filter((r) => r.success).length

      await this.completeAction(action.id, {
        platformsSynced: successful,
        totalPlatforms: platforms.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async preventOverselling(): Promise<void> {
    const action = await this.logAction(
      "prevent_overselling",
      "Checking for overselling risks"
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

      let adjusted = 0

      for (const product of products) {
        // Calculate total listed quantity across platforms
        const totalListed = product.platformListings.reduce(
          (sum, listing) => sum + (listing.quantity || 0),
          0
        )

        // If total listed exceeds actual inventory, adjust listings
        if (totalListed > product.quantity) {
          const adjustedQuantity = Math.floor(product.quantity / product.platformListings.length)

          // Update each platform listing
          for (const listing of product.platformListings) {
            await prisma.platformListing.update({
              where: { id: listing.id },
              data: { quantity: adjustedQuantity },
            })
          }

          adjusted++
        }
      }

      await this.completeAction(action.id, {
        productsAdjusted: adjusted,
        totalProducts: products.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async generateReorderRecommendations(): Promise<void> {
    const action = await this.logAction(
      "reorder_recommendations",
      "Generating reorder recommendations"
    )

    try {
      const config = await this.getConfig()
      const threshold = config.lowStockThreshold || 10

      const lowStockProducts = await prisma.product.findMany({
        where: {
          userId: this.userId,
          status: "ACTIVE",
          quantity: { lte: threshold },
        },
      })

      const recommendations = lowStockProducts.map((product) => ({
        productId: product.id,
        sku: product.sku,
        title: product.title,
        currentQuantity: product.quantity,
        recommendedOrder: this.calculateReorderQuantity(product),
        priority: product.quantity === 0 ? "critical" : product.quantity <= 5 ? "high" : "medium",
        estimatedCost: this.calculateReorderQuantity(product) * product.price * 0.7,
      }))

      // Store recommendations
      await prisma.reorderRecommendation.createMany({
        data: recommendations.map((rec) => ({
          userId: this.userId,
          productId: rec.productId,
          recommendedQuantity: rec.recommendedOrder,
          priority: rec.priority,
          estimatedCost: rec.estimatedCost,
        })),
        skipDuplicates: true,
      })

      await this.completeAction(action.id, {
        recommendationsGenerated: recommendations.length,
        totalCost: recommendations.reduce((sum, r) => sum + r.estimatedCost, 0),
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private calculateReorderQuantity(product: any): number {
    // Calculate based on average sales rate
    // For now, use a simple formula: reorder to 30 days of inventory
    const estimatedMonthlySales = 20 // Placeholder
    const safetyStock = 10

    return Math.max(estimatedMonthlySales + safetyStock - product.quantity, 0)
  }
}
