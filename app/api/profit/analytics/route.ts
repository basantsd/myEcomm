import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { ProfitAnalyzer } from "@/lib/profit/analyzer"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const period = searchParams.get("period") || "30" // days
    const days = parseInt(period)

    const endDate = new Date()
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const analyzer = new ProfitAnalyzer(user.id)

    const [metrics, productProfitability, platformMetrics, forecast] = await Promise.all([
      analyzer.calculateProfitMetrics(startDate, endDate),
      analyzer.getProductProfitability(startDate, endDate),
      analyzer.getProfitByPlatform(startDate, endDate),
      analyzer.forecastProfit(days),
    ])

    return NextResponse.json({
      metrics,
      topProducts: productProfitability.slice(0, 10),
      platformMetrics,
      forecast,
      period: `Last ${days} days`,
    })
  } catch (error) {
    console.error("Get profit analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch profit analytics" },
      { status: 500 }
    )
  }
}
