import { Platform } from "@prisma/client"

export interface OrderSyncResult {
  platform: Platform
  success: boolean
  orderCount?: number
  error?: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId?: string
  sku: string
  title: string
  quantity: number
  price: number
  platformItemId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  userId: string
  platform: Platform
  platformOrderId: string
  status: string
  customerName: string
  customerEmail: string
  shippingAddress: any
  total: number
  currency: string
  orderDate: Date
  items: OrderItem[]
  createdAt: Date
  updatedAt: Date
}

export interface OrderImportOptions {
  startDate?: Date
  endDate?: Date
  status?: string
  limit?: number
}

export interface OrderUpdateData {
  status?: string
  trackingNumber?: string
  carrier?: string
  shippedAt?: Date
  notes?: string
}

export const ORDER_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]
