"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface AgentMetrics {
  tasksCompleted: number
  tasksInProgress: number
  tasksFailed: number
  timeSaved: number
  lastActiveAt: Date | null
  uptime: number
}

interface AgentAction {
  id: string
  actionType: string
  description: string
  status: string
  createdAt: Date
  completedAt?: Date
  result?: any
}

interface Agent {
  role: string
  name: string
  description: string
  icon: string
  salaryEquivalent: number
  enabled: boolean
  automationLevel: string
  metrics: AgentMetrics
  recentActions: AgentAction[]
}

export default function AITeamPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/ai-agents")
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (err) {
      console.error("Failed to fetch AI agents:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAgent = async (agent: Agent, enabled: boolean) => {
    try {
      await fetch(`/api/ai-agents/${agent.role.toLowerCase()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          automationLevel: agent.automationLevel,
          settings: {},
        }),
      })

      fetchAgents()
    } catch (err) {
      console.error("Failed to toggle agent:", err)
    }
  }

  const handleExecuteAgent = async (agent: Agent) => {
    setExecuting(agent.role)

    try {
      const response = await fetch(`/api/ai-agents/${agent.role.toLowerCase()}/execute`, {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        alert(`${agent.name} is now working!`)
        setTimeout(() => fetchAgents(), 2000)
      } else {
        alert(data.error || "Failed to execute agent")
      }
    } catch (err) {
      console.error("Execute agent error:", err)
      alert("Failed to execute agent")
    } finally {
      setExecuting(null)
    }
  }

  const handleChangeAutomationLevel = async (agent: Agent, level: string) => {
    try {
      await fetch(`/api/ai-agents/${agent.role.toLowerCase()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: agent.enabled,
          automationLevel: level,
          settings: {},
        }),
      })

      fetchAgents()
    } catch (err) {
      console.error("Failed to change automation level:", err)
    }
  }

  const totalTimeSaved = agents.reduce((sum, a) => sum + a.metrics.timeSaved, 0)
  const totalSalarySaved = agents.filter((a) => a.enabled).reduce((sum, a) => sum + a.salaryEquivalent, 0)
  const activeAgents = agents.filter((a) => a.enabled).length
  const totalTasks = agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-lg">Loading AI Team...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your AI Team</h1>
          <p className="text-muted-foreground">
            10 AI agents working 24/7 to run your business autonomously
          </p>
        </div>

        {/* Value Proposition Banner */}
        <Card className="mb-8 border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Agents</p>
                <p className="text-3xl font-bold text-green-700">{activeAgents}/10</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold text-green-700">{totalTasks}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Time Saved</p>
                <p className="text-3xl font-bold text-green-700">{totalTimeSaved.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cost Savings</p>
                <p className="text-3xl font-bold text-green-700">
                  ${(totalSalarySaved * 12).toLocaleString()}/yr
                </p>
                <p className="text-xs text-muted-foreground">vs ${(totalSalarySaved * 12).toLocaleString()} salary</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card
              key={agent.role}
              className={`${
                agent.enabled ? "border-blue-200 bg-blue-50/30" : "opacity-60"
              } hover:shadow-lg transition-shadow`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{agent.icon}</div>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="text-xs">{agent.role.replace(/_/g, " ")}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">${agent.salaryEquivalent}/mo</p>
                    <p className="text-xs text-muted-foreground">value</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{agent.description}</p>

                {/* Metrics */}
                {agent.enabled && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white rounded">
                      <p className="text-xl font-bold text-green-600">{agent.metrics.tasksCompleted}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="p-2 bg-white rounded">
                      <p className="text-xl font-bold text-blue-600">{agent.metrics.tasksInProgress}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <div className="p-2 bg-white rounded">
                      <p className="text-xl font-bold text-purple-600">{agent.metrics.timeSaved.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">Saved</p>
                    </div>
                  </div>
                )}

                {/* Automation Level */}
                <div>
                  <Label className="text-xs">Automation Level</Label>
                  <Select
                    value={agent.automationLevel}
                    onValueChange={(value) => handleChangeAutomationLevel(agent, value)}
                    disabled={!agent.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Auto</SelectItem>
                      <SelectItem value="supervised">Supervised</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={agent.enabled ? "outline" : "default"}
                    onClick={() => handleToggleAgent(agent, !agent.enabled)}
                    className="flex-1"
                  >
                    {agent.enabled ? "Pause" : "Activate"}
                  </Button>
                  {agent.enabled && (
                    <Button
                      size="sm"
                      onClick={() => handleExecuteAgent(agent)}
                      disabled={executing === agent.role}
                    >
                      {executing === agent.role ? "Running..." : "Run Now"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    Details
                  </Button>
                </div>

                {/* Recent Activity */}
                {agent.recentActions.length > 0 && (
                  <div className="text-xs">
                    <p className="font-medium mb-1">Recent Activity:</p>
                    <div className="space-y-1">
                      {agent.recentActions.slice(0, 2).map((action) => (
                        <div key={action.id} className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              action.status === "completed"
                                ? "bg-green-500"
                                : action.status === "failed"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                          />
                          <span className="truncate">{action.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Details Modal */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{selectedAgent.icon}</div>
                    <div>
                      <CardTitle>{selectedAgent.name}</CardTitle>
                      <CardDescription>{selectedAgent.role.replace(/_/g, " ")}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Detailed Metrics */}
                <div>
                  <h3 className="font-semibold mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="text-2xl font-bold">{selectedAgent.metrics.uptime.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tasks Completed</p>
                      <p className="text-2xl font-bold">{selectedAgent.metrics.tasksCompleted}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time Saved</p>
                      <p className="text-2xl font-bold">{selectedAgent.metrics.timeSaved.toFixed(1)} hours</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Value</p>
                      <p className="text-2xl font-bold">${(selectedAgent.salaryEquivalent * 12).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Actions */}
                <div>
                  <h3 className="font-semibold mb-3">Action History</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedAgent.recentActions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No actions yet</p>
                    ) : (
                      selectedAgent.recentActions.map((action) => (
                        <div key={action.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium">{action.actionType.replace(/_/g, " ")}</span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                action.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : action.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {action.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{action.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(action.createdAt).toLocaleString()}
                          </p>
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
