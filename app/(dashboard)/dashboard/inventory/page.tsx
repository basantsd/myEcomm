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
  quantity: number
  price: number
  status: string
  images: string[]
}

interface LowStockItem {
  productId: string
  sku: string
  title: string
  quantity: number
  threshold: number
}

interface InventoryLog {
  id: string
  productId: string
  oldQuantity: number
  newQuantity: number
  changeReason: string
  createdAt: Date
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [threshold, setThreshold] = useState(10)
  const [adjustQuantity, setAdjustQuantity] = useState("")
  const [adjustReason, setAdjustReason] = useState("")

  useEffect(() => {
    fetchData()
  }, [threshold])

  const fetchData = async () => {
    try {
      const [productsRes, lowStockRes] = await Promise.all([
        fetch("/api/products?limit=100"),
        fetch(`/api/inventory/low-stock?threshold=${threshold}`),
      ])

      const productsData = await productsRes.json()
      const lowStockData = await lowStockRes.json()

      setProducts(productsData.products || [])
      setLowStockItems(lowStockData.lowStockItems || [])
    } catch (err) {
      console.error("Failed to fetch data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncInventory = async (action: "import" | "export") => {
    setSyncing(true)

    try {
      const platforms = ["EBAY", "AMAZON", "ETSY", "SHOPIFY", "WOOCOMMERCE", "GOOGLE_SHOPPING"]

      const response = await fetch("/api/inventory/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          platforms,
          productId: action === "export" && selectedProduct ? selectedProduct.id : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(
          `${action === "import" ? "Import" : "Export"} complete!\\nPlatforms: ${data.summary.successful}/${data.summary.total}\\nUpdated: ${data.summary.updated}`
        )
        fetchData()
      } else {
        alert(data.error || "Sync failed")
      }
    } catch (err) {
      console.error("Sync error:", err)
      alert("Failed to sync inventory")
    } finally {
      setSyncing(false)
    }
  }

  const handleAdjustInventory = async (productId: string) => {
    if (!adjustQuantity) return

    try {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      const response = await fetch("/api/inventory/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [
            {
              sku: product.sku,
              quantity: parseInt(adjustQuantity),
              reason: adjustReason || "Manual adjustment",
              platforms: [], // Don't sync to platforms automatically
            },
          ],
        }),
      })

      if (response.ok) {
        setAdjustQuantity("")
        setAdjustReason("")
        setSelectedProduct(null)
        fetchData()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update inventory")
      }
    } catch (err) {
      console.error("Adjust inventory error:", err)
      alert("Failed to adjust inventory")
    }
  }

  const fetchInventoryLogs = async (productId: string) => {
    try {
      const response = await fetch(`/api/inventory/logs/${productId}?limit=20`)
      const data = await response.json()
      setInventoryLogs(data.logs || [])
    } catch (err) {
      console.error("Failed to fetch logs:", err)
    }
  }

  const totalInventory = products.reduce((sum, p) => sum + p.quantity, 0)
  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.price, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-lg">Loading inventory...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Inventory Management</h1>
            <p className="text-muted-foreground">
              Monitor and sync inventory across all platforms
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleSyncInventory("import")} disabled={syncing} variant="outline">
              {syncing ? "Syncing..." : "↓ Import from Platforms"}
            </Button>
            <Button onClick={() => handleSyncInventory("export")} disabled={syncing}>
              {syncing ? "Syncing..." : "↑ Export to Platforms"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Products</CardDescription>
              <CardTitle className="text-3xl">{products.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Units</CardDescription>
              <CardTitle className="text-3xl">{totalInventory}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Inventory Value</CardDescription>
              <CardTitle className="text-3xl">${totalValue.toFixed(0)}</CardTitle>
            </CardHeader>
          </Card>

          <Card className={lowStockItems.length > 0 ? "border-orange-300 bg-orange-50/50" : ""}>
            <CardHeader className="pb-3">
              <CardDescription>Low Stock Alerts</CardDescription>
              <CardTitle className={`text-3xl ${lowStockItems.length > 0 ? "text-orange-600" : ""}`}>
                {lowStockItems.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <Card className="mb-8 border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="text-orange-700">⚠️ Low Stock Alerts</CardTitle>
              <CardDescription>Products below {threshold} units</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-3 bg-white rounded-md border"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">units left</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const product = products.find((p) => p.id === item.productId)
                          if (product) {
                            setSelectedProduct(product)
                            fetchInventoryLogs(item.productId)
                          }
                        }}
                      >
                        Adjust
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Threshold Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Low Stock Threshold</CardTitle>
            <CardDescription>Set the minimum quantity before triggering alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="threshold">Alert Threshold (units)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
                  min="1"
                />
              </div>
              <Button onClick={() => fetchData()}>Update Alerts</Button>
            </div>
          </CardContent>
        </Card>

        {/* All Products Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>Current inventory levels for all products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {product.images[0] && (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-12 h-12 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/48?text=No+Image"
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className={`text-xl font-bold ${product.quantity <= threshold ? "text-orange-600" : ""}`}>
                        {product.quantity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Value</p>
                      <p className="text-xl font-bold">
                        ${(product.quantity * product.price).toFixed(2)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProduct(product)
                        fetchInventoryLogs(product.id)
                      }}
                    >
                      Adjust
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Adjust Inventory Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Adjust Inventory: {selectedProduct.title}</CardTitle>
                <CardDescription>SKU: {selectedProduct.sku}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Inventory */}
                <div>
                  <Label>Current Quantity</Label>
                  <p className="text-3xl font-bold">{selectedProduct.quantity} units</p>
                </div>

                {/* Adjustment Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newQuantity">New Quantity</Label>
                    <Input
                      id="newQuantity"
                      type="number"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      placeholder={selectedProduct.quantity.toString()}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="reason">Reason (optional)</Label>
                    <Input
                      id="reason"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g., Stock received, Damaged goods, etc."
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAdjustInventory(selectedProduct.id)}
                      disabled={!adjustQuantity}
                      className="flex-1"
                    >
                      Update Inventory
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedProduct(null)
                        setAdjustQuantity("")
                        setAdjustReason("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>

                {/* Inventory History */}
                <div>
                  <h3 className="font-semibold mb-3">Inventory History</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {inventoryLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No history available</p>
                    ) : (
                      inventoryLogs.map((log) => (
                        <div key={log.id} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {log.oldQuantity} → {log.newQuantity} units
                              </p>
                              <p className="text-xs text-muted-foreground">{log.changeReason}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
