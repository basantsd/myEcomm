import { PlatformApiClient } from "@/types/platforms"

export class WooCommerceApiClient implements PlatformApiClient {
  private consumerKey: string
  private consumerSecret: string
  private storeUrl: string

  constructor(consumerKey: string, consumerSecret: string, storeUrl: string) {
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.storeUrl = storeUrl.replace(/\/$/, "") // Remove trailing slash
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64")

    const response = await fetch(`${this.storeUrl}/wp-json/wc/v3${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WooCommerce API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async fetchProducts(options?: { per_page?: number; page?: number }) {
    const params = new URLSearchParams({
      per_page: (options?.per_page || 100).toString(),
      page: (options?.page || 1).toString(),
    })

    return await this.request(`/products?${params}`)
  }

  async fetchOrders(options?: { per_page?: number; page?: number; status?: string }) {
    const params = new URLSearchParams({
      per_page: (options?.per_page || 100).toString(),
      page: (options?.page || 1).toString(),
    })

    if (options?.status) {
      params.append("status", options.status)
    }

    return await this.request(`/orders?${params}`)
  }

  async updateInventory(productId: string, quantity: number) {
    await this.request(`/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify({
        stock_quantity: quantity,
        manage_stock: true,
      }),
    })
  }

  async createProduct(product: any) {
    return await this.request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    })
  }

  async updateProduct(productId: string, updates: any) {
    return await this.request(`/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async getProduct(productId: string) {
    return await this.request(`/products/${productId}`)
  }

  async getOrder(orderId: string) {
    return await this.request(`/orders/${orderId}`)
  }

  async updateOrderStatus(orderId: string, status: string) {
    return await this.request(`/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  }

  async getSystemStatus() {
    return await this.request("/system_status")
  }
}
