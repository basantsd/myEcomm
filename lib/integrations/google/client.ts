import { PlatformApiClient } from "@/types/platforms"

export class GoogleShoppingApiClient implements PlatformApiClient {
  private accessToken: string
  private merchantId: string

  constructor(accessToken: string, merchantId: string) {
    this.accessToken = accessToken
    this.merchantId = merchantId
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `https://shoppingcontent.googleapis.com/content/v2.1/${this.merchantId}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google Shopping API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async fetchProducts(options?: { maxResults?: number; pageToken?: string }) {
    const params = new URLSearchParams({
      maxResults: (options?.maxResults || 250).toString(),
    })

    if (options?.pageToken) {
      params.append("pageToken", options.pageToken)
    }

    const data = await this.request(`/products?${params}`)
    return data.resources || []
  }

  async fetchOrders(options?: { maxResults?: number; pageToken?: string }) {
    const params = new URLSearchParams({
      maxResults: (options?.maxResults || 250).toString(),
    })

    if (options?.pageToken) {
      params.append("pageToken", options.pageToken)
    }

    const data = await this.request(`/orders?${params}`)
    return data.resources || []
  }

  async updateInventory(productId: string, quantity: number) {
    await this.request(`/inventory/${productId}/set`, {
      method: "POST",
      body: JSON.stringify({
        quantity,
        availability: quantity > 0 ? "in stock" : "out of stock",
      }),
    })
  }

  async createProduct(product: any) {
    const data = await this.request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    })
    return data
  }

  async updateProduct(productId: string, updates: any) {
    const data = await this.request(`/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
    return data
  }

  async getProduct(productId: string) {
    return await this.request(`/products/${productId}`)
  }

  async getOrder(orderId: string) {
    return await this.request(`/orders/${orderId}`)
  }

  async getMerchantInfo() {
    return await this.request("")
  }

  async listDatafeedStatuses() {
    return await this.request("/datafeedstatuses")
  }
}
