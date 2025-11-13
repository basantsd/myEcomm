import { PlatformApiClient } from "@/types/platforms"
import crypto from "crypto"

export class AmazonApiClient implements PlatformApiClient {
  private accessToken: string
  private refreshToken: string
  private region: string
  private marketplaceId: string

  constructor(accessToken: string, refreshToken: string, region: string = "us-east-1") {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.region = region
    this.marketplaceId = this.getMarketplaceId(region)
  }

  private getMarketplaceId(region: string): string {
    const marketplaces: Record<string, string> = {
      "us-east-1": "ATVPDKIKX0DER", // US
      "eu-west-1": "A1F83G8C2ARO7P", // UK
      "us-west-2": "A2EUQ1WTGCTBG2", // Canada
    }
    return marketplaces[region] || marketplaces["us-east-1"]
  }

  private getEndpoint(): string {
    const endpoints: Record<string, string> = {
      "us-east-1": "https://sellingpartnerapi-na.amazon.com",
      "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
      "us-west-2": "https://sellingpartnerapi-na.amazon.com",
    }
    return endpoints[this.region] || endpoints["us-east-1"]
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.getEndpoint()}${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        "x-amz-access-token": this.accessToken,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Amazon SP-API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async fetchProducts(options?: { limit?: number; nextToken?: string }) {
    const params = new URLSearchParams({
      MarketplaceIds: this.marketplaceId,
    })

    if (options?.nextToken) {
      params.append("NextToken", options.nextToken)
    }

    const data = await this.request(`/catalog/2022-04-01/items?${params}`)
    return data.items || []
  }

  async fetchOrders(options?: { createdAfter?: string; nextToken?: string }) {
    const params = new URLSearchParams({
      MarketplaceIds: this.marketplaceId,
      CreatedAfter: options?.createdAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (options?.nextToken) {
      params.append("NextToken", options.nextToken)
    }

    const data = await this.request(`/orders/v0/orders?${params}`)
    return data.Orders || []
  }

  async updateInventory(sku: string, quantity: number) {
    await this.request(`/fba/inventory/v1/items/inventory`, {
      method: "POST",
      body: JSON.stringify({
        sellerSku: sku,
        quantity,
      }),
    })
  }

  async createProduct(product: any) {
    return await this.request("/listings/2021-08-01/items", {
      method: "POST",
      body: JSON.stringify(product),
    })
  }

  async updateProduct(sku: string, updates: any) {
    return await this.request(`/listings/2021-08-01/items/${sku}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
  }

  async getOrder(orderId: string) {
    return await this.request(`/orders/v0/orders/${orderId}`)
  }
}
