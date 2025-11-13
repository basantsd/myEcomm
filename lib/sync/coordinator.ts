import cron from "node-cron"
import { Platform } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { queueProductSync, queueOrderSync, queueInventorySync } from "@/lib/queue/jobs"

export class SyncCoordinator {
  private static instance: SyncCoordinator
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map()

  private constructor() {
    this.initializeScheduledSyncs()
  }

  public static getInstance(): SyncCoordinator {
    if (!SyncCoordinator.instance) {
      SyncCoordinator.instance = new SyncCoordinator()
    }
    return SyncCoordinator.instance
  }

  /**
   * Initialize scheduled syncs for all users
   */
  private initializeScheduledSyncs() {
    // Sync orders every 15 minutes
    const orderSyncJob = cron.schedule("*/15 * * * *", async () => {
      console.log("Running scheduled order sync...")
      await this.syncAllUsersOrders()
    })

    // Sync inventory every 30 minutes
    const inventorySyncJob = cron.schedule("*/30 * * * *", async () => {
      console.log("Running scheduled inventory sync...")
      await this.syncAllUsersInventory()
    })

    // Sync products every hour
    const productSyncJob = cron.schedule("0 * * * *", async () => {
      console.log("Running scheduled product sync...")
      await this.syncAllUsersProducts()
    })

    // Cleanup old sync jobs daily at 2 AM
    const cleanupJob = cron.schedule("0 2 * * *", async () => {
      console.log("Running cleanup of old sync jobs...")
      await this.cleanupOldSyncJobs()
    })

    this.scheduledJobs.set("orders", orderSyncJob)
    this.scheduledJobs.set("inventory", inventorySyncJob)
    this.scheduledJobs.set("products", productSyncJob)
    this.scheduledJobs.set("cleanup", cleanupJob)

    console.log("Sync coordinator initialized with scheduled jobs")
  }

  /**
   * Sync orders for all users with connected platforms
   */
  private async syncAllUsersOrders() {
    try {
      const users = await prisma.user.findMany({
        include: {
          platformConnections: true,
        },
      })

      for (const user of users) {
        if (user.platformConnections.length === 0) continue

        const platforms = user.platformConnections.map((c) => c.platform)

        await queueOrderSync({
          userId: user.id,
          platforms,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        })
      }

      console.log(`Queued order sync for ${users.length} users`)
    } catch (error) {
      console.error("Error syncing orders:", error)
    }
  }

  /**
   * Sync inventory for all users with connected platforms
   */
  private async syncAllUsersInventory() {
    try {
      const users = await prisma.user.findMany({
        include: {
          platformConnections: true,
        },
      })

      for (const user of users) {
        if (user.platformConnections.length === 0) continue

        const platforms = user.platformConnections.map((c) => c.platform)

        await queueInventorySync({
          userId: user.id,
          action: "import",
          platforms,
        })
      }

      console.log(`Queued inventory sync for ${users.length} users`)
    } catch (error) {
      console.error("Error syncing inventory:", error)
    }
  }

  /**
   * Sync products for all users with connected platforms
   */
  private async syncAllUsersProducts() {
    try {
      const users = await prisma.user.findMany({
        include: {
          platformConnections: true,
          products: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
            },
          },
        },
      })

      for (const user of users) {
        if (user.platformConnections.length === 0 || user.products.length === 0) continue

        const platforms = user.platformConnections.map((c) => c.platform)

        // Queue sync for each product
        for (const product of user.products) {
          await queueProductSync({
            userId: user.id,
            productId: product.id,
            platforms,
          })
        }
      }

      console.log(`Queued product sync for multiple users`)
    } catch (error) {
      console.error("Error syncing products:", error)
    }
  }

  /**
   * Cleanup sync jobs older than 30 days
   */
  private async cleanupOldSyncJobs() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const result = await prisma.syncJob.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      })

      console.log(`Deleted ${result.count} old sync jobs`)
    } catch (error) {
      console.error("Error cleaning up sync jobs:", error)
    }
  }

  /**
   * Manually trigger sync for a specific user
   */
  async triggerUserSync(userId: string, syncType: "orders" | "inventory" | "products") {
    const connections = await prisma.platformConnection.findMany({
      where: { userId },
    })

    if (connections.length === 0) {
      throw new Error("No platform connections found")
    }

    const platforms = connections.map((c) => c.platform)

    switch (syncType) {
      case "orders":
        await queueOrderSync({
          userId,
          platforms,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        })
        break

      case "inventory":
        await queueInventorySync({
          userId,
          action: "import",
          platforms,
        })
        break

      case "products":
        const products = await prisma.product.findMany({
          where: {
            userId,
            status: "ACTIVE",
          },
          select: { id: true },
        })

        for (const product of products) {
          await queueProductSync({
            userId,
            productId: product.id,
            platforms,
          })
        }
        break
    }
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string) {
    const recentJobs = await prisma.syncJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    const stats = {
      total: recentJobs.length,
      completed: recentJobs.filter((j) => j.status === "completed").length,
      failed: recentJobs.filter((j) => j.status === "failed").length,
      pending: recentJobs.filter((j) => j.status === "pending").length,
      lastSync: recentJobs[0]?.createdAt || null,
    }

    return {
      recentJobs,
      stats,
    }
  }

  /**
   * Stop all scheduled jobs (for graceful shutdown)
   */
  stopAllJobs() {
    this.scheduledJobs.forEach((job, name) => {
      job.stop()
      console.log(`Stopped scheduled job: ${name}`)
    })
  }

  /**
   * Restart all scheduled jobs
   */
  restartAllJobs() {
    this.scheduledJobs.forEach((job, name) => {
      job.start()
      console.log(`Restarted scheduled job: ${name}`)
    })
  }
}

// Export singleton instance
export const syncCoordinator = SyncCoordinator.getInstance()

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("Shutting down sync coordinator...")
  syncCoordinator.stopAllJobs()
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("Shutting down sync coordinator...")
  syncCoordinator.stopAllJobs()
  process.exit(0)
})
