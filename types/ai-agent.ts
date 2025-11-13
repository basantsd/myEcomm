export type AgentRole =
  | "PRODUCT_MANAGER"
  | "CUSTOMER_SERVICE"
  | "PRICE_OPTIMIZER"
  | "INVENTORY_MANAGER"
  | "ORDER_FULFILLMENT"
  | "MARKETING_SPECIALIST"
  | "ANALYTICS_LEAD"
  | "LISTING_OPTIMIZER"
  | "RETURNS_MANAGER"
  | "GROWTH_HACKER"

export type AgentStatus = "active" | "idle" | "working" | "paused" | "error"

export interface AgentMetrics {
  tasksCompleted: number
  tasksInProgress: number
  tasksFailed: number
  timeSaved: number // in hours
  revenueSaved: number
  revenueGenerated: number
  lastActiveAt: Date
  uptime: number // percentage
}

export interface AgentAction {
  id: string
  agentRole: AgentRole
  actionType: string
  description: string
  status: "pending" | "in_progress" | "completed" | "failed"
  metadata: any
  result?: any
  error?: string
  createdAt: Date
  completedAt?: Date
}

export interface AgentDecision {
  decision: string
  confidence: number
  reasoning: string
  suggestedActions: string[]
  requiresApproval: boolean
}

export interface AgentConfig {
  role: AgentRole
  name: string
  description: string
  icon: string
  salaryEquivalent: number // monthly
  enabled: boolean
  automationLevel: "full" | "supervised" | "manual"
  settings: Record<string, any>
}

export const AGENT_CONFIGS: Record<AgentRole, Omit<AgentConfig, "enabled" | "automationLevel" | "settings">> = {
  PRODUCT_MANAGER: {
    role: "PRODUCT_MANAGER",
    name: "Sarah",
    description: "Manages product listings, titles, descriptions, and catalog organization",
    icon: "👩‍💼",
    salaryEquivalent: 3000,
  },
  CUSTOMER_SERVICE: {
    role: "CUSTOMER_SERVICE",
    name: "Lisa",
    description: "Handles customer messages, reviews, and support tickets",
    icon: "👩‍💼",
    salaryEquivalent: 3000,
  },
  PRICE_OPTIMIZER: {
    role: "PRICE_OPTIMIZER",
    name: "Tom",
    description: "Analyzes competition and optimizes pricing for maximum profit",
    icon: "👨‍💼",
    salaryEquivalent: 4000,
  },
  INVENTORY_MANAGER: {
    role: "INVENTORY_MANAGER",
    name: "David",
    description: "Monitors stock levels and prevents overselling",
    icon: "👨‍💼",
    salaryEquivalent: 3500,
  },
  ORDER_FULFILLMENT: {
    role: "ORDER_FULFILLMENT",
    name: "Mike",
    description: "Processes orders and manages shipping logistics",
    icon: "👨‍💼",
    salaryEquivalent: 3500,
  },
  MARKETING_SPECIALIST: {
    role: "MARKETING_SPECIALIST",
    name: "Emma",
    description: "Creates promotions and optimizes product visibility",
    icon: "👩‍💼",
    salaryEquivalent: 4000,
  },
  ANALYTICS_LEAD: {
    role: "ANALYTICS_LEAD",
    name: "James",
    description: "Analyzes sales data and provides business insights",
    icon: "👨‍💼",
    salaryEquivalent: 5000,
  },
  LISTING_OPTIMIZER: {
    role: "LISTING_OPTIMIZER",
    name: "Rachel",
    description: "Optimizes product listings for search and conversion",
    icon: "👩‍💼",
    salaryEquivalent: 3500,
  },
  RETURNS_MANAGER: {
    role: "RETURNS_MANAGER",
    name: "Maria",
    description: "Handles return requests and customer refunds",
    icon: "👩‍💼",
    salaryEquivalent: 3000,
  },
  GROWTH_HACKER: {
    role: "GROWTH_HACKER",
    name: "Kevin",
    description: "Identifies growth opportunities and scaling strategies",
    icon: "👨‍💼",
    salaryEquivalent: 5000,
  },
}
