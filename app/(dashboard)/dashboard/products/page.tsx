"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLATFORM_CONFIGS } from "@/types/platforms"

interface Product {
  id: string
  sku: string
  title: string
  price: number
  quantity: number
  status: string
  images: string[]
  platformListings: Array<{
    platform: string
    status: string
    lastSyncedAt: Date
  }>
  createdAt: Date
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    sku: "",
    price: "",
    quantity: "",
    images: "",
    category: "",
    tags: "",
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products?limit=50")
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      console.error("Failed to fetch products:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          sku: formData.sku,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity),
          images: formData.images.split(",").map((url) => url.trim()).filter(Boolean),
          category: formData.category,
          tags: formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          status: "ACTIVE",
        }),
      })

      if (response.ok) {
        setShowCreateForm(false)
        setFormData({
          title: "",
          description: "",
          sku: "",
          price: "",
          quantity: "",
          images: "",
          category: "",
          tags: "",
        })
        fetchProducts()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to create product")
      }
    } catch (err) {
      console.error("Create product error:", err)
      alert("Failed to create product")
    }
  }

  const handleSyncProduct = async (productId: string, platforms: string[]) => {
    setSyncing(productId)

    try {
      const response = await fetch(`/api/products/${productId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platforms }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(
          `Sync complete!\nSuccessful: ${data.summary.successful}\nFailed: ${data.summary.failed}`
        )
        fetchProducts()
      } else {
        alert(data.error || "Sync failed")
      }
    } catch (err) {
      console.error("Sync error:", err)
      alert("Failed to sync product")
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-lg">Loading products...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Products</h1>
            <p className="text-muted-foreground">
              Manage your products and sync them across platforms
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Cancel" : "+ Add Product"}
          </Button>
        </div>

        {/* Create Product Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Product</CardTitle>
              <CardDescription>Add a product to your inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Product Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="images">Image URLs (comma-separated)</Label>
                    <Input
                      id="images"
                      value={formData.images}
                      onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                      placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="electronics, gadgets, sale"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">Create Product</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Products Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Products</CardDescription>
              <CardTitle className="text-3xl">{products.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Products</CardDescription>
              <CardTitle className="text-3xl">
                {products.filter((p) => p.status === "ACTIVE").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Inventory</CardDescription>
              <CardTitle className="text-3xl">
                {products.reduce((sum, p) => sum + p.quantity, 0)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Synced Platforms</CardDescription>
              <CardTitle className="text-3xl">
                {products.reduce((sum, p) => sum + p.platformListings.length, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Products List */}
        <div className="space-y-4">
          {products.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">No products yet</p>
                <Button onClick={() => setShowCreateForm(true)}>Create Your First Product</Button>
              </CardContent>
            </Card>
          ) : (
            products.map((product) => (
              <Card key={product.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      {product.images[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-20 h-20 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.src = "https://via.placeholder.com/80?text=No+Image"
                          }}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">{product.title}</h3>
                        <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                        <p className="text-sm mt-1">
                          ${product.price} • {product.quantity} in stock
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {product.status}
                          </span>
                          {product.platformListings.map((listing) => {
                            const config = PLATFORM_CONFIGS[listing.platform as keyof typeof PLATFORM_CONFIGS]
                            return (
                              <span
                                key={listing.platform}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1"
                              >
                                {config.icon} {config.displayName}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const platforms = prompt("Enter platform codes (comma-separated):\nEBAY, AMAZON, ETSY, SHOPIFY, WOOCOMMERCE, GOOGLE_SHOPPING")
                          if (platforms) {
                            handleSyncProduct(
                              product.id,
                              platforms.split(",").map((p) => p.trim().toUpperCase())
                            )
                          }
                        }}
                        disabled={syncing === product.id}
                      >
                        {syncing === product.id ? "Syncing..." : "Sync to Platforms"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
