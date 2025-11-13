import Queue from "bull"
import { Platform } from "@prisma/client"
import { ProductSyncEngine } from "@/lib/sync/product-sync"
import { OrderSyncEngine } from "@/lib/sync/order-sync"
import { InventorySyncEngine } from "@/lib/sync/inventory-sync"
import { prisma } from "@/lib/db/client"

// Initialize job queues
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

export const productSyncQueue = new Queue("product-sync", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export const orderSyncQueue = new Queue("order-sync", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export const inventorySyncQueue = new Queue("inventory-sync", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export const webhookQueue = new Queue("webhook-processing", REDIS_URL, {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
})

// Job data types
export interface ProductSyncJobData {
  userId: string
  productId: string
  platforms: Platform[]
}

export interface OrderSyncJobData {
  userId: string
  platforms: Platform[]
  startDate?: Date
  endDate?: Date
}

export interface InventorySyncJobData {
  userId: string
  action: "import" | "export"
  platforms: Platform[]
  productId?: string
}

export interface WebhookJobData {
  platform: Platform
  event: string
  payload: any
  userId: string
}

// Job processors
productSyncQueue.process(async (job) => {
  const { userId, productId, platforms } = job.data as ProductSyncJobData

  console.log(`Processing product sync job for user ${userId}, product ${productId}`)

  const syncEngine = new ProductSyncEngine(userId)
  const results = await syncEngine.syncProduct(productId, platforms)

  // Update sync job status
  await prisma.syncJob.create({
    data: {
      userId,
      type: "PRODUCT_SYNC",
      platform: platforms[0], // Primary platform
      status: results.every((r) => r.success) ? "completed" : "failed",
      details: results,
    },
  })

  return results
})

orderSyncQueue.process(async (job) => {
  const { userId, platforms, startDate, endDate } = job.data as OrderSyncJobData

  console.log(`Processing order sync job for user ${userId}`)

  const syncEngine = new OrderSyncEngine(userId)
  const results = await syncEngine.importOrders(platforms, { startDate, endDate })

  // Update sync job status
  await prisma.syncJob.create({
    data: {
      userId,
      type: "ORDER_SYNC",
      platform: platforms[0],
      status: results.every((r) => r.success) ? "completed" : "failed",
      details: results,
    },
  })

  return results
})

inventorySyncQueue.process(async (job) => {
  const { userId, action, platforms, productId } = job.data as InventorySyncJobData

  console.log(`Processing inventory ${action} job for user ${userId}`)

  const syncEngine = new InventorySyncEngine(userId)
  let results

  if (action === "import") {
    results = await syncEngine.importInventory(platforms)
  } else if (productId) {
    results = await syncEngine.syncInventoryToPlatforms(productId, platforms)
  } else {
    throw new Error("Product ID required for inventory export")
  }

  // Update sync job status
  await prisma.syncJob.create({
    data: {
      userId,
      type: "INVENTORY_SYNC",
      platform: platforms[0],
      status: results.every((r: any) => r.success) ? "completed" : "failed",
      details: results,
    },
  })

  return results
})

webhookQueue.process(async (job) => {
  const { platform, event, payload, userId } = job.data as WebhookJobData

  console.log(`Processing webhook: ${platform} - ${event}`)

  // Store webhook event
  await prisma.webhook.create({
    data: {
      userId,
      platform,
      event,
      payload,
      status: "processing",
    },
  })

  // Process webhook based on event type
  switch (event) {
    case "order.created":
    case "order.updated":
      // Import the specific order
      const orderSyncEngine = new OrderSyncEngine(userId)
      // Process order webhook payload
      break

    case "inventory.updated":
      // Sync inventory for specific product
      const inventorySyncEngine = new InventorySyncEngine(userId)
      // Process inventory webhook payload
      break

    case "product.updated":
      // Sync product details
      const productSyncEngine = new ProductSyncEngine(userId)
      // Process product webhook payload
      break

    default:
      console.log(`Unknown webhook event: ${event}`)
  }

  // Update webhook status
  await prisma.webhook.updateMany({
    where: {
      userId,
      platform,
      event,
      payload,
    },
    data: {
      status: "processed",
      processedAt: new Date(),
    },
  })

  return { success: true }
})

// Job queue event handlers
productSyncQueue.on("completed", (job, result) => {
  console.log(`Product sync job ${job.id} completed:`, result)
})

productSyncQueue.on("failed", (job, err) => {
  console.error(`Product sync job ${job.id} failed:`, err)
})

orderSyncQueue.on("completed", (job, result) => {
  console.log(`Order sync job ${job.id} completed:`, result)
})

orderSyncQueue.on("failed", (job, err) => {
  console.error(`Order sync job ${job.id} failed:`, err)
})

inventorySyncQueue.on("completed", (job, result) => {
  console.log(`Inventory sync job ${job.id} completed:`, result)
})

inventorySyncQueue.on("failed", (job, err) => {
  console.error(`Inventory sync job ${job.id} failed:`, err)
})

webhookQueue.on("completed", (job, result) => {
  console.log(`Webhook job ${job.id} completed:`, result)
})

webhookQueue.on("failed", (job, err) => {
  console.error(`Webhook job ${job.id} failed:`, err)
})

// Helper functions to add jobs
export async function queueProductSync(data: ProductSyncJobData) {
  return productSyncQueue.add(data, {
    priority: 2, // Medium priority
  })
}

export async function queueOrderSync(data: OrderSyncJobData) {
  return orderSyncQueue.add(data, {
    priority: 1, // High priority
  })
}

export async function queueInventorySync(data: InventorySyncJobData) {
  return inventorySyncQueue.add(data, {
    priority: 1, // High priority
  })
}

export async function queueWebhookProcessing(data: WebhookJobData) {
  return webhookQueue.add(data, {
    priority: 1, // High priority - real-time
  })
}
