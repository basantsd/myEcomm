import { Platform } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { getPlatformConnection } from "@/lib/integrations/connection-manager"
import { EbayApiClient } from "@/lib/integrations/ebay/client"
import { AmazonApiClient } from "@/lib/integrations/amazon/client"
import { EtsyApiClient } from "@/lib/integrations/etsy/client"
import { ShopifyApiClient } from "@/lib/integrations/shopify/client"
import { WooCommerceApiClient } from "@/lib/integrations/woocommerce/client"
import { GoogleShoppingApiClient } from "@/lib/integrations/google/client"

export interface InventorySyncResult {
  platform: Platform
  success: boolean
  updated?: number
  error?: string
}

export interface InventoryUpdateRequest {
  sku: string
  quantity: number
  platforms: Platform[]
}

export class InventorySyncEngine {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Sync inventory from platforms to local database
   */
  async importInventory(platforms: Platform[]): Promise<InventorySyncResult[]> {
    const results: InventorySyncResult[] = []

    for (const platform of platforms) {
      try {
        const result = await this.importFromSinglePlatform(platform)
        results.push(result)
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return results
  }

  /**
   * Sync inventory from local database to platforms
   */
  async syncInventoryToPlat forms(
    productId: string,
    platforms: Platform[]
  ): Promise<InventorySyncResult[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      throw new Error("Product not found")
    }

    const results: InventorySyncResult[] = []

    for (const platform of platforms) {
      try {
        const result = await this.updatePlatformInventory(platform, product.sku, product.quantity)
        results.push(result)
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return results
  }

  /**
   * Bulk update inventory across all platforms
   */
  async bulkUpdateInventory(updates: InventoryUpdateRequest[]): Promise<InventorySyncResult[]> {
    const allResults: InventorySyncResult[] = []

    for (const update of updates) {
      for (const platform of update.platforms) {
        try {
          const result = await this.updatePlatformInventory(platform, update.sku, update.quantity)
          allResults.push(result)
        } catch (error) {
          allResults.push({
            platform,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    }

    return allResults
  }

  private async importFromSinglePlatform(platform: Platform): Promise<InventorySyncResult> {
    const connection = await getPlatformConnection(this.userId, platform)

    if (!connection) {
      return {
        platform,
        success: false,
        error: "Platform not connected",
      }
    }

    let inventoryData: Array<{ sku: string; quantity: number }> = []

    try {
      switch (platform) {
        case Platform.EBAY:
          inventoryData = await this.fetchEbayInventory(connection.accessToken)
          break

        case Platform.AMAZON:
          inventoryData = await this.fetchAmazonInventory(
            connection.accessToken,
            connection.refreshToken!
          )
          break

        case Platform.ETSY:
          inventoryData = await this.fetchEtsyInventory(connection.accessToken)
          break

        case Platform.SHOPIFY:
          const shopDomain = connection.metadata?.shop || connection.metadata?.domain
          inventoryData = await this.fetchShopifyInventory(connection.accessToken, shopDomain)
          break

        case Platform.WOOCOMMERCE:
          inventoryData = await this.fetchWooCommerceInventory(
            process.env.WOOCOMMERCE_CONSUMER_KEY!,
            process.env.WOOCOMMERCE_CONSUMER_SECRET!,
            process.env.WOOCOMMERCE_STORE_URL!
          )
          break

        case Platform.GOOGLE_SHOPPING:
          const merchantId = connection.metadata?.merchantId
          inventoryData = await this.fetchGoogleInventory(connection.accessToken, merchantId)
          break

        default:
          throw new Error(`Platform ${platform} not supported`)
      }

      // Update local inventory
      let updatedCount = 0
      for (const item of inventoryData) {
        const product = await prisma.product.findUnique({
          where: { sku: item.sku },
        })

        if (product) {
          await prisma.product.update({
            where: { sku: item.sku },
            data: { quantity: item.quantity },
          })

          // Log inventory change
          await prisma.inventoryLog.create({
            data: {
              productId: product.id,
              oldQuantity: product.quantity,
              newQuantity: item.quantity,
              changeReason: `Synced from ${platform}`,
            },
          })

          updatedCount++
        }
      }

      return {
        platform,
        success: true,
        updated: updatedCount,
      }
    } catch (error) {
      throw error
    }
  }

  private async updatePlatformInventory(
    platform: Platform,
    sku: string,
    quantity: number
  ): Promise<InventorySyncResult> {
    const connection = await getPlatformConnection(this.userId, platform)

    if (!connection) {
      return {
        platform,
        success: false,
        error: "Platform not connected",
      }
    }

    try {
      switch (platform) {
        case Platform.EBAY:
          await this.updateEbayInventory(connection.accessToken, sku, quantity)
          break

        case Platform.AMAZON:
          await this.updateAmazonInventory(
            connection.accessToken,
            connection.refreshToken!,
            sku,
            quantity
          )
          break

        case Platform.ETSY:
          await this.updateEtsyInventory(connection.accessToken, sku, quantity)
          break

        case Platform.SHOPIFY:
          const shopDomain = connection.metadata?.shop || connection.metadata?.domain
          await this.updateShopifyInventory(connection.accessToken, shopDomain, sku, quantity)
          break

        case Platform.WOOCOMMERCE:
          await this.updateWooCommerceInventory(
            process.env.WOOCOMMERCE_CONSUMER_KEY!,
            process.env.WOOCOMMERCE_CONSUMER_SECRET!,
            process.env.WOOCOMMERCE_STORE_URL!,
            sku,
            quantity
          )
          break

        case Platform.GOOGLE_SHOPPING:
          const merchantId = connection.metadata?.merchantId
          await this.updateGoogleInventory(connection.accessToken, merchantId, sku, quantity)
          break

        default:
          throw new Error(`Platform ${platform} not supported`)
      }

      // Update platform listing
      const product = await prisma.product.findUnique({
        where: { sku },
      })

      if (product) {
        await prisma.platformListing.updateMany({
          where: {
            productId: product.id,
            platform,
          },
          data: {
            quantity,
            lastSyncedAt: new Date(),
          },
        })
      }

      return {
        platform,
        success: true,
        updated: 1,
      }
    } catch (error) {
      throw error
    }
  }

  // Fetch inventory methods
  private async fetchEbayInventory(accessToken: string): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new EbayApiClient(accessToken, process.env.EBAY_ENVIRONMENT === "sandbox")
    const products = await client.fetchProducts({ limit: 100 })

    return products.map((p: any) => ({
      sku: p.sku,
      quantity: p.availability?.shipToLocationAvailability?.quantity || 0,
    }))
  }

  private async fetchAmazonInventory(
    accessToken: string,
    refreshToken: string
  ): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new AmazonApiClient(accessToken, refreshToken)
    const inventory = await client.fetchProducts({ limit: 100 })

    return inventory.map((item: any) => ({
      sku: item.sku,
      quantity: item.quantity || 0,
    }))
  }

  private async fetchEtsyInventory(accessToken: string): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new EtsyApiClient(accessToken)
    const shops = await client.getUserShops()

    if (!shops.length) {
      return []
    }

    const products = await client.fetchProducts({ shopId: shops[0].shop_id, limit: 100 })

    return products.map((p: any) => ({
      sku: p.sku || p.listing_id.toString(),
      quantity: p.quantity || 0,
    }))
  }

  private async fetchShopifyInventory(
    accessToken: string,
    shop: string
  ): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new ShopifyApiClient(accessToken, shop)
    const products = await client.fetchProducts({ limit: 100 })

    const inventory: Array<{ sku: string; quantity: number }> = []
    for (const product of products) {
      if (product.variants) {
        for (const variant of product.variants) {
          inventory.push({
            sku: variant.sku,
            quantity: variant.inventory_quantity || 0,
          })
        }
      }
    }

    return inventory
  }

  private async fetchWooCommerceInventory(
    consumerKey: string,
    consumerSecret: string,
    storeUrl: string
  ): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new WooCommerceApiClient(consumerKey, consumerSecret, storeUrl)
    const products = await client.fetchProducts({ per_page: 100 })

    return products.map((p: any) => ({
      sku: p.sku,
      quantity: p.stock_quantity || 0,
    }))
  }

  private async fetchGoogleInventory(
    accessToken: string,
    merchantId: string
  ): Promise<Array<{ sku: string; quantity: number }>> {
    const client = new GoogleShoppingApiClient(accessToken, merchantId)
    const products = await client.fetchProducts({ maxResults: 100 })

    return products.map((p: any) => ({
      sku: p.offerId,
      quantity: parseInt(p.availability === "in stock" ? "999" : "0"), // Google doesn't provide exact quantities
    }))
  }

  // Update inventory methods
  private async updateEbayInventory(accessToken: string, sku: string, quantity: number): Promise<void> {
    const client = new EbayApiClient(accessToken, process.env.EBAY_ENVIRONMENT === "sandbox")
    await client.updateInventory(sku, quantity)
  }

  private async updateAmazonInventory(
    accessToken: string,
    refreshToken: string,
    sku: string,
    quantity: number
  ): Promise<void> {
    const client = new AmazonApiClient(accessToken, refreshToken)
    await client.updateInventory(sku, quantity)
  }

  private async updateEtsyInventory(accessToken: string, sku: string, quantity: number): Promise<void> {
    const client = new EtsyApiClient(accessToken)
    // Etsy requires listing_id, not SKU
    // This is simplified - in production, you'd need to map SKU to listing_id
    await client.updateInventory(sku, quantity)
  }

  private async updateShopifyInventory(
    accessToken: string,
    shop: string,
    sku: string,
    quantity: number
  ): Promise<void> {
    const client = new ShopifyApiClient(accessToken, shop)
    await client.updateInventory(sku, quantity)
  }

  private async updateWooCommerceInventory(
    consumerKey: string,
    consumerSecret: string,
    storeUrl: string,
    sku: string,
    quantity: number
  ): Promise<void> {
    const client = new WooCommerceApiClient(consumerKey, consumerSecret, storeUrl)
    await client.updateInventory(sku, quantity)
  }

  private async updateGoogleInventory(
    accessToken: string,
    merchantId: string,
    sku: string,
    quantity: number
  ): Promise<void> {
    const client = new GoogleShoppingApiClient(accessToken, merchantId)
    await client.updateInventory(sku, quantity)
  }

  /**
   * Check for low stock products and return alerts
   */
  async checkLowStock(threshold: number = 10): Promise<Array<{
    productId: string
    sku: string
    title: string
    quantity: number
    threshold: number
  }>> {
    const products = await prisma.product.findMany({
      where: {
        userId: this.userId,
        quantity: {
          lte: threshold,
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
        sku: true,
        title: true,
        quantity: true,
      },
    })

    return products.map((p) => ({
      ...p,
      threshold,
    }))
  }

  /**
   * Get inventory logs for a product
   */
  async getInventoryLogs(productId: string, limit: number = 50) {
    return prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  }
}
