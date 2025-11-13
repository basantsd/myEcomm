import { PlatformApiClient } from "@/types/platforms"

export class ShopifyApiClient implements PlatformApiClient {
  private accessToken: string
  private shop: string
  private apiVersion: string = "2024-01"

  constructor(accessToken: string, shop: string) {
    this.accessToken = accessToken
    this.shop = shop
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `https://${this.shop}/admin/api/${this.apiVersion}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Shopify API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async fetchProducts(options?: { limit?: number; sinceId?: string }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 250).toString(),
    })

    if (options?.sinceId) {
      params.append("since_id", options.sinceId)
    }

    const data = await this.request(`/products.json?${params}`)
    return data.products || []
  }

  async fetchOrders(options?: { limit?: number; sinceId?: string; status?: string }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 250).toString(),
      status: options?.status || "any",
    })

    if (options?.sinceId) {
      params.append("since_id", options.sinceId)
    }

    const data = await this.request(`/orders.json?${params}`)
    return data.orders || []
  }

  async updateInventory(inventoryItemId: string, quantity: number, locationId: string) {
    await this.request("/inventory_levels/set.json", {
      method: "POST",
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: quantity,
      }),
    })
  }

  async createProduct(product: any) {
    const data = await this.request("/products.json", {
      method: "POST",
      body: JSON.stringify({ product }),
    })
    return data.product
  }

  async updateProduct(productId: string, updates: any) {
    const data = await this.request(`/products/${productId}.json`, {
      method: "PUT",
      body: JSON.stringify({ product: updates }),
    })
    return data.product
  }

  async getProduct(productId: string) {
    const data = await this.request(`/products/${productId}.json`)
    return data.product
  }

  async getOrder(orderId: string) {
    const data = await this.request(`/orders/${orderId}.json`)
    return data.order
  }

  async getShop() {
    const data = await this.request("/shop.json")
    return data.shop
  }

  async getLocations() {
    const data = await this.request("/locations.json")
    return data.locations || []
  }

  async getInventoryLevels(inventoryItemIds: string[]) {
    const params = new URLSearchParams({
      inventory_item_ids: inventoryItemIds.join(","),
    })

    const data = await this.request(`/inventory_levels.json?${params}`)
    return data.inventory_levels || []
  }
}
