import { prisma } from "@/lib/db/client"
import { AgentRole, AgentStatus, AgentAction, AgentDecision, AgentMetrics } from "@/types/ai-agent"

export abstract class BaseAIAgent {
  protected userId: string
  protected role: AgentRole
  protected status: AgentStatus = "idle"

  constructor(userId: string, role: AgentRole) {
    this.userId = userId
    this.role = role
  }

  /**
   * Main execution loop - to be implemented by each agent
   */
  abstract execute(): Promise<void>

  /**
   * Make a decision based on current data
   */
  abstract decide(context: any): Promise<AgentDecision>

  /**
   * Get agent metrics
   */
  async getMetrics(): Promise<AgentMetrics> {
    const actions = await prisma.agentAction.findMany({
      where: {
        userId: this.userId,
        agentRole: this.role,
      },
    })

    const completedActions = actions.filter((a) => a.status === "completed")
    const failedActions = actions.filter((a) => a.status === "failed")
    const inProgressActions = actions.filter((a) => a.status === "in_progress")

    const lastAction = actions[0]

    return {
      tasksCompleted: completedActions.length,
      tasksInProgress: inProgressActions.length,
      tasksFailed: failedActions.length,
      timeSaved: this.calculateTimeSaved(completedActions.length),
      revenueSaved: this.calculateRevenueSaved(completedActions.length),
      revenueGenerated: 0, // To be calculated by specific agents
      lastActiveAt: lastAction?.createdAt || new Date(),
      uptime: actions.length > 0 ? (completedActions.length / actions.length) * 100 : 100,
    }
  }

  /**
   * Log an action
   */
  protected async logAction(
    actionType: string,
    description: string,
    metadata: any = {}
  ): Promise<AgentAction> {
    const action = await prisma.agentAction.create({
      data: {
        userId: this.userId,
        agentRole: this.role,
        actionType,
        description,
        status: "in_progress",
        metadata,
      },
    })

    return action as AgentAction
  }

  /**
   * Complete an action
   */
  protected async completeAction(
    actionId: string,
    result: any
  ): Promise<void> {
    await prisma.agentAction.update({
      where: { id: actionId },
      data: {
        status: "completed",
        result,
        completedAt: new Date(),
      },
    })
  }

  /**
   * Fail an action
   */
  protected async failAction(
    actionId: string,
    error: string
  ): Promise<void> {
    await prisma.agentAction.update({
      where: { id: actionId },
      data: {
        status: "failed",
        error,
        completedAt: new Date(),
      },
    })
  }

  /**
   * Calculate time saved based on completed tasks
   * Average time per task: 15 minutes
   */
  private calculateTimeSaved(tasksCompleted: number): number {
    return (tasksCompleted * 15) / 60 // Convert to hours
  }

  /**
   * Calculate revenue saved based on completed tasks
   * Based on salary equivalent
   */
  private calculateRevenueSaved(tasksCompleted: number): number {
    const salaryPerTask = 50 // Assuming $50 per task equivalent
    return tasksCompleted * salaryPerTask
  }

  /**
   * Set agent status
   */
  protected setStatus(status: AgentStatus): void {
    this.status = status
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.status
  }

  /**
   * Check if agent should run (based on configuration)
   */
  protected async shouldRun(): Promise<boolean> {
    const config = await prisma.agentConfig.findUnique({
      where: {
        userId_agentRole: {
          userId: this.userId,
          agentRole: this.role,
        },
      },
    })

    return config?.enabled ?? false
  }

  /**
   * Get agent configuration
   */
  protected async getConfig(): Promise<any> {
    const config = await prisma.agentConfig.findUnique({
      where: {
        userId_agentRole: {
          userId: this.userId,
          agentRole: this.role,
        },
      },
    })

    return config?.settings || {}
  }

  /**
   * Check if action requires approval
   */
  protected async requiresApproval(): Promise<boolean> {
    const config = await prisma.agentConfig.findUnique({
      where: {
        userId_agentRole: {
          userId: this.userId,
          agentRole: this.role,
        },
      },
    })

    return config?.automationLevel !== "full"
  }
}
