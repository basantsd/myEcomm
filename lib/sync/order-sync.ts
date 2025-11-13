import { Platform } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { getPlatformConnection } from "@/lib/integrations/connection-manager"
import { EbayApiClient } from "@/lib/integrations/ebay/client"
import { AmazonApiClient } from "@/lib/integrations/amazon/client"
import { EtsyApiClient } from "@/lib/integrations/etsy/client"
import { ShopifyApiClient } from "@/lib/integrations/shopify/client"
import { WooCommerceApiClient } from "@/lib/integrations/woocommerce/client"
import { GoogleShoppingApiClient } from "@/lib/integrations/google/client"
import { OrderImportOptions, OrderSyncResult } from "@/types/order"

export class OrderSyncEngine {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async importOrders(
    platforms: Platform[],
    options: OrderImportOptions = {}
  ): Promise<OrderSyncResult[]> {
    const results: OrderSyncResult[] = []

    for (const platform of platforms) {
      try {
        const result = await this.importFromSinglePlatform(platform, options)
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

  private async importFromSinglePlatform(
    platform: Platform,
    options: OrderImportOptions
  ): Promise<OrderSyncResult> {
    const connection = await getPlatformConnection(this.userId, platform)

    if (!connection) {
      return {
        platform,
        success: false,
        error: "Platform not connected",
      }
    }

    let orders: any[] = []

    try {
      switch (platform) {
        case Platform.EBAY:
          orders = await this.fetchEbayOrders(connection.accessToken, options)
          break

        case Platform.AMAZON:
          orders = await this.fetchAmazonOrders(
            connection.accessToken,
            connection.refreshToken!,
            options
          )
          break

        case Platform.ETSY:
          orders = await this.fetchEtsyOrders(connection.accessToken, options)
          break

        case Platform.SHOPIFY:
          const shopDomain = connection.metadata?.shop || connection.metadata?.domain
          orders = await this.fetchShopifyOrders(connection.accessToken, shopDomain, options)
          break

        case Platform.WOOCOMMERCE:
          orders = await this.fetchWooCommerceOrders(
            process.env.WOOCOMMERCE_CONSUMER_KEY!,
            process.env.WOOCOMMERCE_CONSUMER_SECRET!,
            process.env.WOOCOMMERCE_STORE_URL!,
            options
          )
          break

        case Platform.GOOGLE_SHOPPING:
          const merchantId = connection.metadata?.merchantId
          orders = await this.fetchGoogleOrders(connection.accessToken, merchantId, options)
          break

        default:
          throw new Error(`Platform ${platform} not supported`)
      }

      // Save orders to database
      let importedCount = 0
      for (const orderData of orders) {
        try {
          await this.saveOrder(platform, orderData)
          importedCount++
        } catch (error) {
          console.error(`Failed to save order ${orderData.platformOrderId}:`, error)
        }
      }

      return {
        platform,
        success: true,
        orderCount: importedCount,
      }
    } catch (error) {
      throw error
    }
  }

  private async saveOrder(platform: Platform, orderData: any): Promise<void> {
    // Check if order already exists
    const existing = await prisma.order.findUnique({
      where: {
        userId_platformOrderId: {
          userId: this.userId,
          platformOrderId: orderData.platformOrderId,
        },
      },
    })

    if (existing) {
      // Update existing order
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: orderData.status,
          total: orderData.total,
          shippingAddress: orderData.shippingAddress,
        },
      })
      return
    }

    // Create new order with items
    await prisma.order.create({
      data: {
        userId: this.userId,
        platform,
        platformOrderId: orderData.platformOrderId,
        status: orderData.status,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        shippingAddress: orderData.shippingAddress,
        total: orderData.total,
        currency: orderData.currency || "USD",
        orderDate: orderData.orderDate,
        items: {
          create: orderData.items.map((item: any) => ({
            sku: item.sku,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            platformItemId: item.platformItemId,
          })),
        },
      },
    })
  }

  private async fetchEbayOrders(
    accessToken: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new EbayApiClient(accessToken, process.env.EBAY_ENVIRONMENT === "sandbox")
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((order: any) => ({
      platformOrderId: order.orderId,
      status: this.normalizeEbayStatus(order.orderFulfillmentStatus),
      customerName: order.buyer?.fullName || "Unknown",
      customerEmail: order.buyer?.email,
      shippingAddress: {
        name: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName,
        addressLine1: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.addressLine1,
        addressLine2: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.addressLine2,
        city: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.city,
        state: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.stateOrProvince,
        postalCode: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.postalCode,
        country: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.countryCode,
      },
      total: parseFloat(order.pricingSummary?.total?.value || "0"),
      currency: order.pricingSummary?.total?.currency || "USD",
      orderDate: new Date(order.creationDate),
      items: order.lineItems?.map((item: any) => ({
        sku: item.sku,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.lineItemCost?.value || "0"),
        platformItemId: item.lineItemId,
      })) || [],
    }))
  }

  private async fetchAmazonOrders(
    accessToken: string,
    refreshToken: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new AmazonApiClient(accessToken, refreshToken)
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((order: any) => ({
      platformOrderId: order.AmazonOrderId,
      status: this.normalizeAmazonStatus(order.OrderStatus),
      customerName: order.BuyerInfo?.BuyerName || "Unknown",
      customerEmail: order.BuyerInfo?.BuyerEmail,
      shippingAddress: {
        name: order.ShippingAddress?.Name,
        addressLine1: order.ShippingAddress?.AddressLine1,
        addressLine2: order.ShippingAddress?.AddressLine2,
        city: order.ShippingAddress?.City,
        state: order.ShippingAddress?.StateOrRegion,
        postalCode: order.ShippingAddress?.PostalCode,
        country: order.ShippingAddress?.CountryCode,
      },
      total: parseFloat(order.OrderTotal?.Amount || "0"),
      currency: order.OrderTotal?.CurrencyCode || "USD",
      orderDate: new Date(order.PurchaseDate),
      items: [], // Amazon requires separate API call for order items
    }))
  }

  private async fetchEtsyOrders(
    accessToken: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new EtsyApiClient(accessToken)
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((receipt: any) => ({
      platformOrderId: receipt.receipt_id.toString(),
      status: this.normalizeEtsyStatus(receipt.status),
      customerName: receipt.name || "Unknown",
      customerEmail: receipt.buyer_email,
      shippingAddress: {
        name: receipt.name,
        addressLine1: receipt.first_line,
        addressLine2: receipt.second_line,
        city: receipt.city,
        state: receipt.state,
        postalCode: receipt.zip,
        country: receipt.country_iso,
      },
      total: parseFloat(receipt.grandtotal?.amount || "0") / 100,
      currency: receipt.grandtotal?.currency_code || "USD",
      orderDate: new Date(receipt.create_timestamp * 1000),
      items: receipt.transactions?.map((txn: any) => ({
        sku: txn.product_data?.sku || txn.listing_id.toString(),
        title: txn.title,
        quantity: txn.quantity,
        price: parseFloat(txn.price?.amount || "0") / 100,
        platformItemId: txn.transaction_id.toString(),
      })) || [],
    }))
  }

  private async fetchShopifyOrders(
    accessToken: string,
    shop: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new ShopifyApiClient(accessToken, shop)
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((order: any) => ({
      platformOrderId: order.id.toString(),
      status: this.normalizeShopifyStatus(order.fulfillment_status),
      customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : "Unknown",
      customerEmail: order.email,
      shippingAddress: {
        name: order.shipping_address?.name,
        addressLine1: order.shipping_address?.address1,
        addressLine2: order.shipping_address?.address2,
        city: order.shipping_address?.city,
        state: order.shipping_address?.province,
        postalCode: order.shipping_address?.zip,
        country: order.shipping_address?.country_code,
        phone: order.shipping_address?.phone,
      },
      total: parseFloat(order.total_price || "0"),
      currency: order.currency || "USD",
      orderDate: new Date(order.created_at),
      items: order.line_items?.map((item: any) => ({
        sku: item.sku || item.id.toString(),
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price || "0"),
        platformItemId: item.id.toString(),
      })) || [],
    }))
  }

  private async fetchWooCommerceOrders(
    consumerKey: string,
    consumerSecret: string,
    storeUrl: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new WooCommerceApiClient(consumerKey, consumerSecret, storeUrl)
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((order: any) => ({
      platformOrderId: order.id.toString(),
      status: this.normalizeWooStatus(order.status),
      customerName: `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() || "Unknown",
      customerEmail: order.billing?.email,
      shippingAddress: {
        name: `${order.shipping?.first_name || ""} ${order.shipping?.last_name || ""}`.trim(),
        addressLine1: order.shipping?.address_1,
        addressLine2: order.shipping?.address_2,
        city: order.shipping?.city,
        state: order.shipping?.state,
        postalCode: order.shipping?.postcode,
        country: order.shipping?.country,
        phone: order.billing?.phone,
      },
      total: parseFloat(order.total || "0"),
      currency: order.currency || "USD",
      orderDate: new Date(order.date_created),
      items: order.line_items?.map((item: any) => ({
        sku: item.sku || item.product_id.toString(),
        title: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || "0"),
        platformItemId: item.id.toString(),
      })) || [],
    }))
  }

  private async fetchGoogleOrders(
    accessToken: string,
    merchantId: string,
    options: OrderImportOptions
  ): Promise<any[]> {
    const client = new GoogleShoppingApiClient(accessToken, merchantId)
    const rawOrders = await client.fetchOrders(options)

    return rawOrders.map((order: any) => ({
      platformOrderId: order.id,
      status: this.normalizeGoogleStatus(order.status),
      customerName: order.customer?.fullName || "Unknown",
      customerEmail: order.customer?.email,
      shippingAddress: {
        name: order.shippingAddress?.recipientName,
        addressLine1: order.shippingAddress?.streetAddress?.[0],
        addressLine2: order.shippingAddress?.streetAddress?.[1],
        city: order.shippingAddress?.locality,
        state: order.shippingAddress?.region,
        postalCode: order.shippingAddress?.postalCode,
        country: order.shippingAddress?.country,
      },
      total: parseFloat(order.netPriceAmount?.value || "0"),
      currency: order.netPriceAmount?.currency || "USD",
      orderDate: new Date(order.placedDate),
      items: order.lineItems?.map((item: any) => ({
        sku: item.product?.offerId || item.id,
        title: item.product?.title,
        quantity: item.quantityOrdered,
        price: parseFloat(item.price?.value || "0"),
        platformItemId: item.id,
      })) || [],
    }))
  }

  // Status normalization methods
  private normalizeEbayStatus(status: string): string {
    const statusMap: Record<string, string> = {
      NOT_STARTED: "PENDING",
      IN_PROGRESS: "PROCESSING",
      FULFILLED: "SHIPPED",
    }
    return statusMap[status] || "PENDING"
  }

  private normalizeAmazonStatus(status: string): string {
    const statusMap: Record<string, string> = {
      Pending: "PENDING",
      Unshipped: "PROCESSING",
      PartiallyShipped: "PROCESSING",
      Shipped: "SHIPPED",
      Canceled: "CANCELLED",
    }
    return statusMap[status] || "PENDING"
  }

  private normalizeEtsyStatus(status: string): string {
    const statusMap: Record<string, string> = {
      open: "PENDING",
      paid: "PROCESSING",
      completed: "SHIPPED",
      canceled: "CANCELLED",
    }
    return statusMap[status] || "PENDING"
  }

  private normalizeShopifyStatus(status: string | null): string {
    if (!status) return "PENDING"
    const statusMap: Record<string, string> = {
      null: "PENDING",
      pending: "PENDING",
      fulfilled: "SHIPPED",
      partial: "PROCESSING",
    }
    return statusMap[status] || "PENDING"
  }

  private normalizeWooStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: "PENDING",
      processing: "PROCESSING",
      "on-hold": "PENDING",
      completed: "DELIVERED",
      cancelled: "CANCELLED",
      refunded: "REFUNDED",
      failed: "CANCELLED",
    }
    return statusMap[status] || "PENDING"
  }

  private normalizeGoogleStatus(status: string): string {
    const statusMap: Record<string, string> = {
      active: "PROCESSING",
      shipped: "SHIPPED",
      delivered: "DELIVERED",
      canceled: "CANCELLED",
      returned: "REFUNDED",
    }
    return statusMap[status] || "PENDING"
  }
}
