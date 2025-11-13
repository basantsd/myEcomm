import { NextRequest, NextResponse } from "next/server"
import { AgentRole } from "@prisma/client"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"

export async function GET(
  req: NextRequest,
  { params }: { params: { agentRole: string } }
) {
  try {
    const user = await requireAuth()
    const agentRole = params.agentRole.toUpperCase() as AgentRole

    const config = await prisma.agentConfig.findUnique({
      where: {
        userId_agentRole: {
          userId: user.id,
          agentRole,
        },
      },
    })

    const actions = await prisma.agentAction.findMany({
      where: {
        userId: user.id,
        agentRole,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      config,
      actions,
    })
  } catch (error) {
    console.error("Get agent details error:", error)
    return NextResponse.json(
      { error: "Failed to fetch agent details" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { agentRole: string } }
) {
  try {
    const user = await requireAuth()
    const agentRole = params.agentRole.toUpperCase() as AgentRole
    const body = await req.json()

    const { enabled, automationLevel, settings } = body

    const config = await prisma.agentConfig.upsert({
      where: {
        userId_agentRole: {
          userId: user.id,
          agentRole,
        },
      },
      update: {
        enabled,
        automationLevel,
        settings,
      },
      create: {
        userId: user.id,
        agentRole,
        enabled: enabled ?? true,
        automationLevel: automationLevel ?? "supervised",
        settings: settings ?? {},
      },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error("Update agent config error:", error)
    return NextResponse.json(
      { error: "Failed to update agent configuration" },
      { status: 500 }
    )
  }
}
