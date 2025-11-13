import { NextRequest, NextResponse } from "next/server"
import { AgentRole } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { SarahProductManager } from "@/lib/ai/agents/sarah-product-manager"
import { LisaCustomerService } from "@/lib/ai/agents/lisa-customer-service"
import { TomPriceOptimizer } from "@/lib/ai/agents/tom-price-optimizer"
import { DavidInventoryManager } from "@/lib/ai/agents/david-inventory-manager"
import { MikeOrderFulfillment } from "@/lib/ai/agents/mike-order-fulfillment"
import { EmmaMarketingSpecialist } from "@/lib/ai/agents/emma-marketing-specialist"

export async function POST(
  req: NextRequest,
  { params }: { params: { agentRole: string } }
) {
  try {
    const user = await requireAuth()
    const agentRole = params.agentRole.toUpperCase() as AgentRole

    // Create agent instance
    let agent

    switch (agentRole) {
      case "PRODUCT_MANAGER":
        agent = new SarahProductManager(user.id)
        break
      case "CUSTOMER_SERVICE":
        agent = new LisaCustomerService(user.id)
        break
      case "PRICE_OPTIMIZER":
        agent = new TomPriceOptimizer(user.id)
        break
      case "INVENTORY_MANAGER":
        agent = new DavidInventoryManager(user.id)
        break
      case "ORDER_FULFILLMENT":
        agent = new MikeOrderFulfillment(user.id)
        break
      case "MARKETING_SPECIALIST":
        agent = new EmmaMarketingSpecialist(user.id)
        break
      default:
        return NextResponse.json(
          { error: "Invalid agent role" },
          { status: 400 }
        )
    }

    // Execute agent (runs in background)
    agent.execute().catch((error) => {
      console.error(`Agent ${agentRole} execution error:`, error)
    })

    return NextResponse.json({
      success: true,
      message: `${agentRole} agent execution started`,
    })
  } catch (error) {
    console.error("Execute agent error:", error)
    return NextResponse.json(
      { error: "Failed to execute agent" },
      { status: 500 }
    )
  }
}
