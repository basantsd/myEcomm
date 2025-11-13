import { z } from "zod"

export const productSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().min(0, "Price must be positive"),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  quantity: z.number().int().min(0, "Quantity must be non-negative"),
  images: z.array(z.string().url()).default([]),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  variants: z.any().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
})

export const productUpdateSchema = productSchema.partial()

export const bulkProductSchema = z.object({
  products: z.array(productSchema),
})

export const syncProductSchema = z.object({
  productId: z.string(),
  platforms: z.array(z.string()),
})

export type ProductInput = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type BulkProductInput = z.infer<typeof bulkProductSchema>
export type SyncProductInput = z.infer<typeof syncProductSchema>
