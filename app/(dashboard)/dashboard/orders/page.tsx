"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PLATFORM_CONFIGS } from "@/types/platforms"
import { ORDER_STATUS } from "@/types/order"

interface OrderItem {
  id: string
  sku: string
  title: string
  quantity: number
  price: number
}

interface Order {
  id: string
  platform: string
  platformOrderId: string
  status: string
  customerName: string
  customerEmail: string
  shippingAddress: any
  total: number
  currency: string
  orderDate: Date
  items: OrderItem[]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchOrders()
  }, [statusFilter, platformFilter, searchQuery])

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (platformFilter !== "all") params.append("platform", platformFilter)
      if (searchQuery) params.append("search", searchQuery)

      const response = await fetch(`/api/orders?${params}`)
      const data = await response.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error("Failed to fetch orders:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleImportOrders = async () => {
    setImporting(true)

    try {
      const platforms = ["EBAY", "AMAZON", "ETSY", "SHOPIFY", "WOOCOMMERCE", "GOOGLE_SHOPPING"]

      const response = await fetch("/api/orders/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platforms,
          limit: 100,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(
          `Import complete!\\nPlatforms: ${data.summary.successful}/${data.summary.total}\\nOrders imported: ${data.summary.ordersImported}`
        )
        fetchOrders()
      } else {
        alert(data.error || "Import failed")
      }
    } catch (err) {
      console.error("Import error:", err)
      alert("Failed to import orders")
    } finally {
      setImporting(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        fetchOrders()
        setSelectedOrder(null)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update order")
      }
    } catch (err) {
      console.error("Update order error:", err)
      alert("Failed to update order")
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-700",
      PROCESSING: "bg-blue-100 text-blue-700",
      SHIPPED: "bg-purple-100 text-purple-700",
      DELIVERED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700",
      REFUNDED: "bg-gray-100 text-gray-700",
    }
    return colors[status] || "bg-gray-100 text-gray-700"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-lg">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Orders</h1>
            <p className="text-muted-foreground">
              Manage orders from all your connected platforms
            </p>
          </div>
          <Button onClick={handleImportOrders} disabled={importing}>
            {importing ? "Importing..." : "↻ Import Orders"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{orders.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl">
                {orders.filter((o) => o.status === "PENDING").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Processing</CardDescription>
              <CardTitle className="text-2xl">
                {orders.filter((o) => o.status === "PROCESSING").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Shipped</CardDescription>
              <CardTitle className="text-2xl">
                {orders.filter((o) => o.status === "SHIPPED").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Delivered</CardDescription>
              <CardTitle className="text-2xl">
                {orders.filter((o) => o.status === "DELIVERED").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Revenue</CardDescription>
              <CardTitle className="text-2xl">
                ${orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Order ID, customer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.keys(ORDER_STATUS).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="platform">Platform</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="All Platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {Object.keys(PLATFORM_CONFIGS).slice(0, 6).map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS].displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">No orders yet</p>
                <Button onClick={handleImportOrders}>Import Your First Orders</Button>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {PLATFORM_CONFIGS[order.platform as keyof typeof PLATFORM_CONFIGS]?.icon}{" "}
                          Order #{order.platformOrderId}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground">Customer</p>
                          <p className="font-medium">{order.customerName}</p>
                          {order.customerEmail && (
                            <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                          )}
                        </div>

                        <div>
                          <p className="text-muted-foreground">Shipping Address</p>
                          <p className="font-medium">
                            {order.shippingAddress?.city}, {order.shippingAddress?.state}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.shippingAddress?.country}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium text-lg">
                            ${order.total.toFixed(2)} {order.currency}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium mb-2">Items ({order.items.length})</p>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.title}
                              </span>
                              <span className="text-muted-foreground">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrder(order)}
                      >
                        Update Status
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Update Status Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Update Order Status</CardTitle>
                <CardDescription>Order #{selectedOrder.platformOrderId}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newStatus">New Status</Label>
                    <Select
                      onValueChange={(value) => handleUpdateStatus(selectedOrder.id, value)}
                    >
                      <SelectTrigger id="newStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ORDER_STATUS).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                      Cancel
                    </Button>
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
