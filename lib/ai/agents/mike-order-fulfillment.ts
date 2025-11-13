import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Mike - Order Fulfillment AI
 * Processes orders and manages shipping logistics
 */
export class MikeOrderFulfillment extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "ORDER_FULFILLMENT")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Process pending orders
      await this.processPendingOrders()

      // Task 2: Update shipping status
      await this.updateShippingStatus()

      // Task 3: Handle delayed shipments
      await this.handleDelayedShipments()

      // Task 4: Optimize shipping routes
      await this.optimizeShipping()

      this.setStatus("idle")
    } catch (error) {
      console.error("Mike execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { order } = context

    if (!order) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No order context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const orderAge = Date.now() - new Date(order.orderDate).getTime()
    const hoursOld = orderAge / (1000 * 60 * 60)

    let decision = "no_action"
    let actions: string[] = []
    let confidence = 0.9

    if (order.status === "PENDING" && hoursOld > 24) {
      decision = "expedite_order"
      actions.push("Process order immediately")
      actions.push("Upgrade to express shipping")
      actions.push("Notify customer of delay")
      confidence = 0.95
    } else if (order.status === "PENDING") {
      decision = "process_order"
      actions.push("Verify inventory availability")
      actions.push("Generate shipping label")
      actions.push("Update order status to PROCESSING")
      confidence = 0.9
    } else if (order.status === "PROCESSING" && hoursOld > 48) {
      decision = "investigate_delay"
      actions.push("Check with warehouse")
      actions.push("Contact shipping carrier")
      actions.push("Provide customer update")
      confidence = 0.85
    }

    return {
      decision,
      confidence,
      reasoning: hoursOld > 24
        ? `Order is ${Math.floor(hoursOld)} hours old and needs attention`
        : `Order processing is on track (${Math.floor(hoursOld)} hours old)`,
      suggestedActions: actions,
      requiresApproval: hoursOld > 48 || await this.requiresApproval(),
    }
  }

  private async processPendingOrders(): Promise<void> {
    const action = await this.logAction(
      "process_pending_orders",
      "Processing pending orders"
    )

    try {
      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "PENDING",
        },
        include: {
          items: true,
        },
        orderBy: {
          orderDate: "asc",
        },
        take: 50,
      })

      let processed = 0

      for (const order of orders) {
        // Check inventory availability
        const hasInventory = await this.checkInventoryAvailability(order)

        if (hasInventory) {
          // Update order status
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "PROCESSING",
              trackingNumber: this.generateTrackingNumber(),
              carrier: this.selectCarrier(order),
            },
          })

          // Reserve inventory
          await this.reserveInventory(order)

          processed++
        } else {
          // Create notification for out of stock
          await prisma.notification.create({
            data: {
              userId: this.userId,
              type: "OUT_OF_STOCK",
              title: `Order ${order.platformOrderId} - Inventory Issue`,
              message: `Cannot fulfill order due to insufficient inventory`,
              priority: "high",
              metadata: { orderId: order.id },
            },
          })
        }
      }

      await this.completeAction(action.id, {
        ordersProcessed: processed,
        totalOrders: orders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async updateShippingStatus(): Promise<void> {
    const action = await this.logAction(
      "update_shipping_status",
      "Updating shipping status for orders"
    )

    try {
      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "PROCESSING",
        },
      })

      let updated = 0

      for (const order of orders) {
        // In a real implementation, this would query shipping carrier APIs
        // For now, simulate status updates based on order age
        const daysSinceOrder = (Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceOrder > 2 && daysSinceOrder < 7) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "SHIPPED",
              shippedAt: new Date(),
            },
          })
          updated++
        } else if (daysSinceOrder >= 7) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "DELIVERED",
            },
          })
          updated++
        }
      }

      await this.completeAction(action.id, {
        ordersUpdated: updated,
        totalOrders: orders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async handleDelayedShipments(): Promise<void> {
    const action = await this.logAction(
      "handle_delayed_shipments",
      "Handling delayed shipments"
    )

    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

      const delayedOrders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "PENDING",
          orderDate: { lte: twoDaysAgo },
        },
      })

      for (const order of delayedOrders) {
        // Create notification
        await prisma.notification.create({
          data: {
            userId: this.userId,
            type: "DELAYED_SHIPMENT",
            title: `Delayed Order: ${order.platformOrderId}`,
            message: `Order from ${order.orderDate.toDateString()} has not shipped yet`,
            priority: "high",
            metadata: { orderId: order.id },
          },
        })

        // Send customer notification (in a real implementation)
        await prisma.message.create({
          data: {
            userId: this.userId,
            orderId: order.id,
            platform: order.platform,
            messageType: "delay_notification",
            content: this.generateDelayMessage(order),
            status: "pending",
          },
        })
      }

      await this.completeAction(action.id, {
        delayedOrders: delayedOrders.length,
        notificationsSent: delayedOrders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async optimizeShipping(): Promise<void> {
    const action = await this.logAction(
      "optimize_shipping",
      "Optimizing shipping routes and carriers"
    )

    try {
      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "PENDING",
        },
      })

      // Group orders by destination region
      const ordersByRegion = this.groupOrdersByRegion(orders)

      let optimized = 0

      for (const [region, regionOrders] of Object.entries(ordersByRegion)) {
        // Select optimal carrier for region
        const optimalCarrier = this.selectOptimalCarrierForRegion(region)

        for (const order of regionOrders) {
          await prisma.order.update({
            where: { id: order.id },
            data: { carrier: optimalCarrier },
          })
          optimized++
        }
      }

      await this.completeAction(action.id, {
        ordersOptimized: optimized,
        regionsProcessed: Object.keys(ordersByRegion).length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private async checkInventoryAvailability(order: any): Promise<boolean> {
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { sku: item.sku },
      })

      if (!product || product.quantity < item.quantity) {
        return false
      }
    }
    return true
  }

  private async reserveInventory(order: any): Promise<void> {
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { sku: item.sku },
      })

      if (product) {
        await prisma.product.update({
          where: { sku: item.sku },
          data: {
            quantity: Math.max(0, product.quantity - item.quantity),
          },
        })

        // Log inventory change
        await prisma.inventoryLog.create({
          data: {
            productId: product.id,
            oldQuantity: product.quantity,
            newQuantity: Math.max(0, product.quantity - item.quantity),
            changeReason: `Reserved for order ${order.platformOrderId}`,
          },
        })
      }
    }
  }

  private generateTrackingNumber(): string {
    return `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`
  }

  private selectCarrier(order: any): string {
    const carriers = ["USPS", "FedEx", "UPS", "DHL"]

    // Simple logic: use USPS for domestic, FedEx for international
    const isInternational = order.shippingAddress?.country !== "US"

    return isInternational ? "FedEx" : "USPS"
  }

  private groupOrdersByRegion(orders: any[]): Record<string, any[]> {
    const regions: Record<string, any[]> = {
      domestic: [],
      international: [],
    }

    for (const order of orders) {
      if (order.shippingAddress?.country === "US") {
        regions.domestic.push(order)
      } else {
        regions.international.push(order)
      }
    }

    return regions
  }

  private selectOptimalCarrierForRegion(region: string): string {
    return region === "domestic" ? "USPS" : "FedEx"
  }

  private generateDelayMessage(order: any): string {
    return `Dear ${order.customerName},

We wanted to update you on your order #${order.platformOrderId}.

We're experiencing a slight delay in processing your order, but rest assured we're working hard to get it shipped as soon as possible. We expect to ship your order within the next 24 hours.

As an apology for the delay, we've upgraded your shipping to express at no additional cost.

Thank you for your patience and understanding!

Best regards,
Fulfillment Team`
  }
}
