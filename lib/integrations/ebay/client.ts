import { PlatformApiClient } from "@/types/platforms"

export class EbayApiClient implements PlatformApiClient {
  private accessToken: string
  private baseUrl: string

  constructor(accessToken: string, sandbox: boolean = false) {
    this.accessToken = accessToken
    this.baseUrl = sandbox
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com"
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`eBay API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async fetchProducts(options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 100).toString(),
      offset: (options?.offset || 0).toString(),
    })

    const data = await this.request(`/sell/inventory/v1/inventory_item?${params}`)
    return data.inventoryItems || []
  }

  async fetchOrders(options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 100).toString(),
      offset: (options?.offset || 0).toString(),
    })

    const data = await this.request(`/sell/fulfillment/v1/order?${params}`)
    return data.orders || []
  }

  async updateInventory(sku: string, quantity: number) {
    await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: "PUT",
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: {
            quantity,
          },
        },
      }),
    })
  }

  async createProduct(product: any) {
    return await this.request("/sell/inventory/v1/inventory_item", {
      method: "POST",
      body: JSON.stringify(product),
    })
  }

  async updateProduct(sku: string, updates: any) {
    return await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async getInventoryItem(sku: string) {
    return await this.request(`/sell/inventory/v1/inventory_item/${sku}`)
  }

  async getOrder(orderId: string) {
    return await this.request(`/sell/fulfillment/v1/order/${orderId}`)
  }

  async getUserProfile() {
    return await this.request("/commerce/identity/v1/user")
  }
}
