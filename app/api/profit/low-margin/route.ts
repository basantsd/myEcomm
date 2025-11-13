import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { ProfitAnalyzer } from "@/lib/profit/analyzer"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams

    const minMargin = parseInt(searchParams.get("minMargin") || "20")

    const analyzer = new ProfitAnalyzer(user.id)
    const lowMarginProducts = await analyzer.identifyLowMarginProducts(minMargin)

    return NextResponse.json({
      products: lowMarginProducts,
      count: lowMarginProducts.length,
      minMargin,
    })
  } catch (error) {
    console.error("Get low margin products error:", error)
    return NextResponse.json(
      { error: "Failed to fetch low margin products" },
      { status: 500 }
    )
  }
}
