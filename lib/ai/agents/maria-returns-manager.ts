import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Maria - Returns Manager AI
 * Handles return requests and customer refunds
 */
export class MariaReturnsManager extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "RETURNS_MANAGER")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Process return requests
      await this.processReturnRequests()

      // Task 2: Approve/deny returns based on policy
      await this.evaluateReturnRequests()

      // Task 3: Process refunds
      await this.processRefunds()

      // Task 4: Analyze return patterns
      await this.analyzeReturnPatterns()

      // Task 5: Update inventory for returns
      await this.updateInventoryForReturns()

      this.setStatus("idle")
    } catch (error) {
      console.error("Maria execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { returnRequest, orderAge, returnReason } = context

    if (!returnRequest) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No return request context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const config = await this.getConfig()
    const returnWindow = config.returnWindowDays || 30

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.85

    // Check if within return window
    if (orderAge > returnWindow) {
      decision = "deny_return"
      actions.push("Politely deny return - outside return window")
      actions.push("Offer store credit as goodwill gesture")
      confidence = 0.95
    } else if (this.isValidReturnReason(returnReason)) {
      decision = "approve_return"
      actions.push("Approve return request")
      actions.push("Generate return shipping label")
      actions.push("Send return instructions to customer")
      actions.push("Process refund upon receipt")
      confidence = 0.9
    } else if (returnReason === "changed_mind" && orderAge < 7) {
      decision = "approve_return"
      actions.push("Approve return (within 7-day satisfaction guarantee)")
      actions.push("Charge restocking fee if applicable")
      confidence = 0.8
    } else {
      decision = "request_more_info"
      actions.push("Request photos of product")
      actions.push("Ask for detailed description of issue")
      actions.push("Offer troubleshooting assistance")
      confidence = 0.75
    }

    return {
      decision,
      confidence,
      reasoning: orderAge > returnWindow
        ? `Order is ${orderAge} days old (return window: ${returnWindow} days)`
        : `Return reason: ${returnReason}`,
      suggestedActions: actions,
      requiresApproval: decision === "approve_return" && Number(returnRequest.amount) > 100,
    }
  }

  private async processReturnRequests(): Promise<void> {
    const action = await this.logAction(
      "process_return_requests",
      "Processing pending return requests"
    )

    try {
      // Find orders that are candidates for returns
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const deliveredOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "DELIVERED",
          orderDate: { gte: thirtyDaysAgo },
        },
        include: {
          items: true,
        },
      })

      // Check for orders marked as REFUNDED (return completed)
      const refundedOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "REFUNDED",
        },
      })

      await this.completeAction(action.id, {
        eligibleForReturn: deliveredOrders.length,
        refundsProcessed: refundedOrders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async evaluateReturnRequests(): Promise<void> {
    const action = await this.logAction(
      "evaluate_return_requests",
      "Evaluating return requests against policy"
    )

    try {
      const config = await this.getConfig()
      const returnWindow = config.returnWindowDays || 30

      const windowDate = new Date(Date.now() - returnWindow * 24 * 60 * 60 * 1000)

      // Find delivered orders within return window
      const eligibleOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "DELIVERED",
          orderDate: { gte: windowDate },
        },
        include: {
          items: true,
        },
      })

      let evaluated = 0

      for (const order of eligibleOrders) {
        // In a real implementation, this would check for actual return requests
        // For now, we'll simulate the evaluation logic
        const orderAge = (Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24)

        if (orderAge <= returnWindow) {
          // Order is within return window - eligible
          evaluated++
        }
      }

      await this.completeAction(action.id, {
        ordersEvaluated: evaluated,
        eligibleReturns: eligibleOrders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async processRefunds(): Promise<void> {
    const action = await this.logAction(
      "process_refunds",
      "Processing approved refunds"
    )

    try {
      // Find orders marked as CANCELLED that need refunds
      const ordersNeedingRefund = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "CANCELLED",
        },
        take: 10,
      })

      let processed = 0

      for (const order of ordersNeedingRefund) {
        // Mark as refunded
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        })

        // Create notification
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: `Refund Processed: Order #${order.platformOrderId}`,
            message: `Refund of $${Number(order.total).toFixed(2)} processed for ${order.customerName}`,
            priority: "MEDIUM",
            metadata: { orderId: order.id },
          },
        })

        processed++
      }

      await this.completeAction(action.id, {
        refundsProcessed: processed,
        totalAmount: ordersNeedingRefund.reduce((sum, o) => sum + Number(o.total), 0),
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async analyzeReturnPatterns(): Promise<void> {
    const action = await this.logAction(
      "analyze_return_patterns",
      "Analyzing return patterns to identify issues"
    )

    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

      const [allOrders, refundedOrders] = await Promise.all([
        prisma.order.findMany({
          where: {
            userId: this.userId,
            orderDate: { gte: sixtyDaysAgo },
          },
          include: { items: true },
        }),
        prisma.order.findMany({
          where: {
            userId: this.userId,
            status: "REFUNDED",
            orderDate: { gte: sixtyDaysAgo },
          },
          include: { items: true },
        }),
      ])

      const returnRate = allOrders.length > 0
        ? (refundedOrders.length / allOrders.length) * 100
        : 0

      // Identify products with high return rates
      const productReturns: Record<string, { returns: number; total: number; title: string }> = {}

      for (const order of allOrders) {
        for (const item of order.items) {
          if (!productReturns[item.sku]) {
            productReturns[item.sku] = {
              returns: 0,
              total: 0,
              title: item.title,
            }
          }
          productReturns[item.sku].total += 1
        }
      }

      for (const order of refundedOrders) {
        for (const item of order.items) {
          if (productReturns[item.sku]) {
            productReturns[item.sku].returns += 1
          }
        }
      }

      // Find products with high return rates (>15%)
      const problematicProducts = Object.entries(productReturns)
        .filter(([_, stats]) => (stats.returns / stats.total) > 0.15 && stats.total >= 3)
        .map(([sku, stats]) => ({
          sku,
          title: stats.title,
          returnRate: ((stats.returns / stats.total) * 100).toFixed(1),
          returns: stats.returns,
          total: stats.total,
        }))

      // Create alerts for problematic products
      for (const product of problematicProducts) {
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "SYSTEM_ALERT",
            title: `⚠️ High Return Rate: ${product.title}`,
            message: `${product.returnRate}% return rate (${product.returns}/${product.total} orders). Review product quality.`,
            priority: "HIGH",
            metadata: product,
          },
        })
      }

      await this.completeAction(action.id, {
        overallReturnRate: returnRate.toFixed(2) + "%",
        totalReturns: refundedOrders.length,
        totalOrders: allOrders.length,
        problematicProducts: problematicProducts.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async updateInventoryForReturns(): Promise<void> {
    const action = await this.logAction(
      "update_inventory_returns",
      "Updating inventory for returned items"
    )

    try {
      // Find recently refunded orders
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const recentReturns = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "REFUNDED",
          updatedAt: { gte: threeDaysAgo },
        },
        include: {
          items: true,
        },
      })

      let itemsRestocked = 0

      for (const order of recentReturns) {
        for (const item of order.items) {
          const product = await prisma.product.findUnique({
            where: { sku: item.sku },
          })

          if (product) {
            const oldQuantity = product.quantity
            const newQuantity = oldQuantity + item.quantity

            // Restock the product
            await prisma.product.update({
              where: { sku: item.sku },
              data: { quantity: newQuantity },
            })

            // Log the inventory change
            await prisma.inventoryLog.create({
              data: {
                productId: product.id,
                oldQuantity,
                newQuantity,
                changeReason: `Returned from order ${order.platformOrderId}`,
              },
            })

            itemsRestocked++
          }
        }
      }

      await this.completeAction(action.id, {
        ordersProcessed: recentReturns.length,
        itemsRestocked,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private isValidReturnReason(reason: string): boolean {
    const validReasons = [
      "defective",
      "damaged",
      "wrong_item",
      "not_as_described",
      "size_issue",
      "quality_issue",
    ]

    return validReasons.includes(reason?.toLowerCase())
  }

  private generateReturnLabel(order: any): string {
    return `RMA-${order.platformOrderId}-${Date.now()}`
  }

  private calculateRestockingFee(orderTotal: number): number {
    // 15% restocking fee for change of mind returns
    return orderTotal * 0.15
  }
}
