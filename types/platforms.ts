import { Platform } from "@prisma/client"

export interface PlatformConfig {
  name: string
  displayName: string
  icon: string
  color: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scope?: string
}

export interface PlatformApiClient {
  fetchProducts: (options?: any) => Promise<any[]>
  fetchOrders: (options?: any) => Promise<any[]>
  updateInventory: (productId: string, quantity: number) => Promise<void>
  createProduct: (product: any) => Promise<any>
  updateProduct: (productId: string, updates: any) => Promise<any>
}

export const PLATFORM_CONFIGS: Record<Platform, Partial<PlatformConfig>> = {
  EBAY: {
    name: "ebay",
    displayName: "eBay",
    icon: "🛒",
    color: "#E53238",
    authUrl: "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
    scopes: ["https://api.ebay.com/oauth/api_scope", "https://api.ebay.com/oauth/api_scope/sell.inventory"],
    clientId: process.env.EBAY_CLIENT_ID || "",
    clientSecret: process.env.EBAY_CLIENT_SECRET || "",
    redirectUri: process.env.NEXTAUTH_URL + "/api/oauth/ebay/callback",
  },
  AMAZON: {
    name: "amazon",
    displayName: "Amazon",
    icon: "📦",
    color: "#FF9900",
    authUrl: "https://sellercentral.amazon.com/apps/authorize/consent",
    scopes: [],
    clientId: process.env.AMAZON_CLIENT_ID || "",
    clientSecret: process.env.AMAZON_CLIENT_SECRET || "",
    redirectUri: process.env.NEXTAUTH_URL + "/api/oauth/amazon/callback",
  },
  ETSY: {
    name: "etsy",
    displayName: "Etsy",
    icon: "🎨",
    color: "#F56400",
    authUrl: "https://www.etsy.com/oauth/connect",
    tokenUrl: "https://api.etsy.com/v3/public/oauth/token",
    scopes: ["listings_r", "listings_w", "transactions_r", "shops_r"],
    clientId: process.env.ETSY_CLIENT_ID || "",
    clientSecret: process.env.ETSY_CLIENT_SECRET || "",
    redirectUri: process.env.NEXTAUTH_URL + "/api/oauth/etsy/callback",
  },
  SHOPIFY: {
    name: "shopify",
    displayName: "Shopify",
    icon: "🛍️",
    color: "#96BF48",
    scopes: ["read_products", "write_products", "read_orders", "write_orders", "read_inventory", "write_inventory"],
    clientId: process.env.SHOPIFY_CLIENT_ID || "",
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
  },
  WALMART: {
    name: "walmart",
    displayName: "Walmart",
    icon: "🏪",
    color: "#0071CE",
  },
  WOOCOMMERCE: {
    name: "woocommerce",
    displayName: "WooCommerce",
    icon: "🔌",
    color: "#96588A",
  },
  BIGCOMMERCE: {
    name: "bigcommerce",
    displayName: "BigCommerce",
    icon: "🏬",
    color: "#121118",
  },
  WIX: {
    name: "wix",
    displayName: "Wix",
    icon: "⚡",
    color: "#0C6EFC",
  },
  GOOGLE_SHOPPING: {
    name: "google_shopping",
    displayName: "Google Shopping",
    icon: "🔍",
    color: "#4285F4",
  },
  MICROSOFT_SHOPPING: {
    name: "microsoft_shopping",
    displayName: "Microsoft Shopping",
    icon: "🪟",
    color: "#00A4EF",
  },
  REVERB: {
    name: "reverb",
    displayName: "Reverb",
    icon: "🎸",
    color: "#FF6600",
  },
  DISCOGS: {
    name: "discogs",
    displayName: "Discogs",
    icon: "💿",
    color: "#333333",
  },
  PRINTIFY: {
    name: "printify",
    displayName: "Printify",
    icon: "🖨️",
    color: "#39B54A",
  },
  PRINTFUL: {
    name: "printful",
    displayName: "Printful",
    icon: "👕",
    color: "#E25041",
  },
  FLIPKART: {
    name: "flipkart",
    displayName: "Flipkart",
    icon: "🇮🇳",
    color: "#2874F0",
  },
  MERCADO_LIBRE: {
    name: "mercado_libre",
    displayName: "Mercado Libre",
    icon: "🇧🇷",
    color: "#FFE600",
  },
  LAZADA: {
    name: "lazada",
    displayName: "Lazada",
    icon: "🇸🇬",
    color: "#0F156D",
  },
  SHOPEE: {
    name: "shopee",
    displayName: "Shopee",
    icon: "🛍️",
    color: "#EE4D2D",
  },
  ALLEGRO: {
    name: "allegro",
    displayName: "Allegro",
    icon: "🇵🇱",
    color: "#FF5A00",
  },
  BOL: {
    name: "bol",
    displayName: "Bol.com",
    icon: "🇳🇱",
    color: "#0000A4",
  },
  ZALANDO: {
    name: "zalando",
    displayName: "Zalando",
    icon: "👗",
    color: "#FF6900",
  },
  COUPANG: {
    name: "coupang",
    displayName: "Coupang",
    icon: "🇰🇷",
    color: "#5319FF",
  },
}
