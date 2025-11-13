import { z } from "zod"

export const orderItemSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  title: z.string().min(1, "Title is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be non-negative"),
  platformItemId: z.string().optional(),
})

export const shippingAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().optional(),
})

export const orderSchema = z.object({
  platform: z.string(),
  platformOrderId: z.string().min(1, "Platform order ID is required"),
  status: z.string(),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email").optional(),
  shippingAddress: shippingAddressSchema,
  total: z.number().min(0, "Total must be non-negative"),
  currency: z.string().default("USD"),
  orderDate: z.coerce.date(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
})

export const orderUpdateSchema = z.object({
  status: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  shippedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
})

export const orderImportSchema = z.object({
  platforms: z.array(z.string()).min(1, "At least one platform is required"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})

export type OrderInput = z.infer<typeof orderSchema>
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>
export type OrderImportInput = z.infer<typeof orderImportSchema>
