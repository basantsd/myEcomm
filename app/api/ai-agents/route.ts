import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { AGENT_CONFIGS } from "@/types/ai-agent"

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()

    // Get all agent configurations
    const configs = await prisma.agentConfig.findMany({
      where: { userId: user.id },
    })

    // Get metrics for each agent
    const agents = await Promise.all(
      Object.values(AGENT_CONFIGS).map(async (agentConfig) => {
        const userConfig = configs.find((c) => c.agentRole === agentConfig.role)

        // Get recent actions
        const actions = await prisma.agentAction.findMany({
          where: {
            userId: user.id,
            agentRole: agentConfig.role,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })

        const completedActions = actions.filter((a) => a.status === "completed")
        const failedActions = actions.filter((a) => a.status === "failed")

        return {
          ...agentConfig,
          enabled: userConfig?.enabled ?? false,
          automationLevel: userConfig?.automationLevel ?? "supervised",
          metrics: {
            tasksCompleted: completedActions.length,
            tasksInProgress: actions.filter((a) => a.status === "in_progress").length,
            tasksFailed: failedActions.length,
            timeSaved: (completedActions.length * 15) / 60, // hours
            lastActiveAt: actions[0]?.createdAt || null,
            uptime: actions.length > 0 ? (completedActions.length / actions.length) * 100 : 100,
          },
          recentActions: actions.slice(0, 5),
        }
      })
    )

    return NextResponse.json({ agents })
  } catch (error) {
    console.error("Get AI agents error:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI agents" },
      { status: 500 }
    )
  }
}
