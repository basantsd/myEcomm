import { Platform } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { getPlatformConnection } from "@/lib/integrations/connection-manager"
import { EbayApiClient } from "@/lib/integrations/ebay/client"
import { AmazonApiClient } from "@/lib/integrations/amazon/client"
import { EtsyApiClient } from "@/lib/integrations/etsy/client"
import { ShopifyApiClient } from "@/lib/integrations/shopify/client"
import { WooCommerceApiClient } from "@/lib/integrations/woocommerce/client"
import { GoogleShoppingApiClient } from "@/lib/integrations/google/client"
import { ProductSyncResult } from "@/types/product"

export class ProductSyncEngine {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async syncProduct(productId: string, platforms: Platform[]): Promise<ProductSyncResult[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { platformListings: true },
    })

    if (!product) {
      throw new Error("Product not found")
    }

    const results: ProductSyncResult[] = []

    for (const platform of platforms) {
      try {
        const result = await this.syncToSinglePlatform(product, platform)
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

  private async syncToSinglePlatform(product: any, platform: Platform): Promise<ProductSyncResult> {
    const connection = await getPlatformConnection(this.userId, platform)

    if (!connection) {
      return {
        platform,
        success: false,
        error: "Platform not connected",
      }
    }

    // Check if product already exists on platform
    const existingListing = product.platformListings.find(
      (listing: any) => listing.platform === platform
    )

    let platformProductId: string

    try {
      switch (platform) {
        case Platform.EBAY:
          platformProductId = await this.syncToEbay(connection.accessToken, product, existingListing)
          break

        case Platform.AMAZON:
          platformProductId = await this.syncToAmazon(
            connection.accessToken,
            connection.refreshToken!,
            product,
            existingListing
          )
          break

        case Platform.ETSY:
          platformProductId = await this.syncToEtsy(connection.accessToken, product, existingListing)
          break

        case Platform.SHOPIFY:
          const shopDomain = connection.metadata?.shop || connection.metadata?.domain
          platformProductId = await this.syncToShopify(
            connection.accessToken,
            shopDomain,
            product,
            existingListing
          )
          break

        case Platform.WOOCOMMERCE:
          platformProductId = await this.syncToWooCommerce(
            process.env.WOOCOMMERCE_CONSUMER_KEY!,
            process.env.WOOCOMMERCE_CONSUMER_SECRET!,
            process.env.WOOCOMMERCE_STORE_URL!,
            product,
            existingListing
          )
          break

        case Platform.GOOGLE_SHOPPING:
          const merchantId = connection.metadata?.merchantId
          platformProductId = await this.syncToGoogle(
            connection.accessToken,
            merchantId,
            product,
            existingListing
          )
          break

        default:
          throw new Error(`Platform ${platform} not supported`)
      }

      // Update or create platform listing
      await prisma.platformListing.upsert({
        where: {
          productId_platform: {
            productId: product.id,
            platform,
          },
        },
        update: {
          platformProductId,
          price: product.price,
          quantity: product.quantity,
          status: "active",
          lastSyncedAt: new Date(),
          syncErrors: null,
        },
        create: {
          productId: product.id,
          platform,
          platformProductId,
          price: product.price,
          quantity: product.quantity,
          status: "active",
        },
      })

      return {
        platform,
        success: true,
        platformProductId,
      }
    } catch (error) {
      // Log sync error
      await prisma.platformListing.upsert({
        where: {
          productId_platform: {
            productId: product.id,
            platform,
          },
        },
        update: {
          syncErrors: error instanceof Error ? error.message : "Unknown error",
        },
        create: {
          productId: product.id,
          platform,
          platformProductId: "error",
          price: product.price,
          quantity: product.quantity,
          status: "error",
          syncErrors: error instanceof Error ? error.message : "Unknown error",
        },
      })

      throw error
    }
  }

  private async syncToEbay(accessToken: string, product: any, existingListing: any): Promise<string> {
    const client = new EbayApiClient(accessToken, process.env.EBAY_ENVIRONMENT === "sandbox")

    const ebayProduct = {
      sku: product.sku,
      product: {
        title: product.title,
        description: product.description,
        imageUrls: product.images,
        aspects: {
          Brand: ["Generic"],
        },
      },
      condition: "NEW",
      availability: {
        shipToLocationAvailability: {
          quantity: product.quantity,
        },
      },
    }

    if (existingListing) {
      await client.updateProduct(product.sku, ebayProduct)
    } else {
      await client.createProduct(ebayProduct)
    }

    return product.sku
  }

  private async syncToAmazon(
    accessToken: string,
    refreshToken: string,
    product: any,
    existingListing: any
  ): Promise<string> {
    const client = new AmazonApiClient(accessToken, refreshToken)

    // Simplified Amazon listing
    const amazonProduct = {
      sku: product.sku,
      productType: "PRODUCT",
      attributes: {
        item_name: [{ value: product.title }],
        bullet_point: product.description ? [{ value: product.description }] : [],
        main_product_image_locator: product.images[0] ? [{ value: product.images[0] }] : [],
      },
    }

    if (existingListing) {
      await client.updateProduct(product.sku, amazonProduct)
    } else {
      await client.createProduct(amazonProduct)
    }

    return product.sku
  }

  private async syncToEtsy(accessToken: string, product: any, existingListing: any): Promise<string> {
    const client = new EtsyApiClient(accessToken)

    // Get first shop
    const shops = await client.getUserShops()
    if (!shops.length) {
      throw new Error("No Etsy shops found")
    }

    const shopId = shops[0].shop_id

    const etsyProduct = {
      title: product.title,
      description: product.description || product.title,
      price: product.price,
      quantity: product.quantity,
      who_made: "i_did",
      when_made: "made_to_order",
      taxonomy_id: 1, // Default category
    }

    if (existingListing) {
      await client.updateProduct(existingListing.platformProductId, etsyProduct)
      return existingListing.platformProductId
    } else {
      const created = await client.createProduct(shopId, etsyProduct)
      return created.listing_id.toString()
    }
  }

  private async syncToShopify(
    accessToken: string,
    shop: string,
    product: any,
    existingListing: any
  ): Promise<string> {
    const client = new ShopifyApiClient(accessToken, shop)

    const shopifyProduct = {
      title: product.title,
      body_html: product.description,
      vendor: "My Store",
      product_type: product.category,
      tags: product.tags.join(","),
      variants: [
        {
          sku: product.sku,
          price: product.price.toString(),
          inventory_quantity: product.quantity,
        },
      ],
      images: product.images.map((url: string) => ({ src: url })),
    }

    if (existingListing) {
      const updated = await client.updateProduct(existingListing.platformProductId, shopifyProduct)
      return updated.id.toString()
    } else {
      const created = await client.createProduct(shopifyProduct)
      return created.id.toString()
    }
  }

  private async syncToWooCommerce(
    consumerKey: string,
    consumerSecret: string,
    storeUrl: string,
    product: any,
    existingListing: any
  ): Promise<string> {
    const client = new WooCommerceApiClient(consumerKey, consumerSecret, storeUrl)

    const wooProduct = {
      name: product.title,
      type: "simple",
      regular_price: product.price.toString(),
      description: product.description,
      short_description: product.description?.substring(0, 100),
      sku: product.sku,
      stock_quantity: product.quantity,
      manage_stock: true,
      images: product.images.map((url: string) => ({ src: url })),
      categories: product.category ? [{ name: product.category }] : [],
      tags: product.tags.map((tag: string) => ({ name: tag })),
    }

    if (existingListing) {
      const updated = await client.updateProduct(existingListing.platformProductId, wooProduct)
      return updated.id.toString()
    } else {
      const created = await client.createProduct(wooProduct)
      return created.id.toString()
    }
  }

  private async syncToGoogle(
    accessToken: string,
    merchantId: string,
    product: any,
    existingListing: any
  ): Promise<string> {
    const client = new GoogleShoppingApiClient(accessToken, merchantId)

    const googleProduct = {
      offerId: product.sku,
      title: product.title,
      description: product.description,
      link: `https://example.com/products/${product.sku}`,
      imageLink: product.images[0],
      contentLanguage: "en",
      targetCountry: "US",
      channel: "online",
      availability: product.quantity > 0 ? "in stock" : "out of stock",
      condition: "new",
      price: {
        value: product.price.toString(),
        currency: "USD",
      },
      brand: "My Brand",
    }

    if (existingListing) {
      await client.updateProduct(product.sku, googleProduct)
    } else {
      await client.createProduct(googleProduct)
    }

    return product.sku
  }
}
