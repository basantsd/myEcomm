import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { RecommendationEngine } from "@/lib/profit/recommendations"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get("type") || "all"

    const engine = new RecommendationEngine(user.id)

    let result: any = {}

    if (type === "crosssell" || type === "all") {
      result.crossSell = await engine.generateCrossSellRecommendations()
    }

    if (type === "bundle" || type === "all") {
      result.bundles = await engine.generateBundleRecommendations()
    }

    if (type === "promote" || type === "all") {
      result.productsToPromote = await engine.recommendProductsToPromote()
    }

    if (type === "all") {
      result.impact = await engine.calculateRecommendationImpact()
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Get recommendations error:", error)
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    )
  }
}
