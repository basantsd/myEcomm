import { PlatformApiClient } from "@/types/platforms"

export class EtsyApiClient implements PlatformApiClient {
  private accessToken: string
  private baseUrl: string = "https://openapi.etsy.com/v3"

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "x-api-key": process.env.ETSY_CLIENT_ID!,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Etsy API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async getUserShops() {
    const data = await this.request("/application/shops")
    return data.results || []
  }

  async fetchProducts(shopId: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 100).toString(),
      offset: (options?.offset || 0).toString(),
    })

    const data = await this.request(`/application/shops/${shopId}/listings/active?${params}`)
    return data.results || []
  }

  async fetchOrders(shopId: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      limit: (options?.limit || 100).toString(),
      offset: (options?.offset || 0).toString(),
    })

    const data = await this.request(`/application/shops/${shopId}/receipts?${params}`)
    return data.results || []
  }

  async updateInventory(listingId: string, quantity: number) {
    const products = await this.request(`/application/listings/${listingId}/inventory`)
    const productId = products.products[0].product_id

    await this.request(`/application/listings/${listingId}/inventory`, {
      method: "PUT",
      body: JSON.stringify({
        products: [
          {
            product_id: productId,
            offerings: [
              {
                offering_id: products.products[0].offerings[0].offering_id,
                quantity,
              },
            ],
          },
        ],
      }),
    })
  }

  async createProduct(shopId: string, product: any) {
    return await this.request(`/application/shops/${shopId}/listings`, {
      method: "POST",
      body: JSON.stringify(product),
    })
  }

  async updateProduct(listingId: string, updates: any) {
    return await this.request(`/application/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
  }

  async getListing(listingId: string) {
    return await this.request(`/application/listings/${listingId}`)
  }

  async getReceipt(shopId: string, receiptId: string) {
    return await this.request(`/application/shops/${shopId}/receipts/${receiptId}`)
  }
}
