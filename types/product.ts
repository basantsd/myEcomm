import { Platform } from "@prisma/client"

export interface ProductSyncResult {
  platform: Platform
  success: boolean
  platformProductId?: string
  error?: string
}

export interface SyncJob {
  id: string
  productId: string
  platforms: Platform[]
  results: ProductSyncResult[]
  status: "pending" | "running" | "completed" | "failed"
}

export interface ProductListingMapping {
  productId: string
  platform: Platform
  platformProductId: string
  platformUrl?: string
  lastSyncedAt: Date
}
